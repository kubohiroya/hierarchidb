/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Feature indices
 * - Vector tiles
 */

import {Dexie, type Table} from 'dexie';
import type {ShapeContainerNodeId, ShapeTileSummaryRecord, VectorTileRecord} from "./VectorTileRecord";
import { VectorTileDbBase } from "@hierarchidb/vectortile-store";
import type { TabularTableMetadataLike } from "@hierarchidb/tabular-store";
import type { NodeId } from "@hierarchidb/core-types";
import type {BuildSessionHeartbeat, BuildSessionRecord, BuildSessionStatus, BuildStageStatus } from "@hierarchidb/gis-sdk";

export class ShapeDB extends VectorTileDbBase {

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;
  tileSummaries!: Table<ShapeTileSummaryRecord, ShapeContainerNodeId>;
  tabularMetadata!: Table<TabularTableMetadataLike, string>;

  // New session tables (version 2)
  buildSessionConfigs!: Table<BuildSessionRecord, NodeId>;
  buildSessionHeartbeats!: Table<BuildSessionHeartbeat, NodeId>;
  buildSessionStatuses!: Table<BuildSessionStatus, NodeId>;
  buildStageStatuses!: Table<BuildStageStatus, string>;

  constructor(databaseName: string) {
    super(databaseName);

    // Version 1: Original schema with monolithic sessions table
    this.version(1).stores(this.mergeVectorTileStores({
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
    }));

    // Version 2: Refactored session schema with four normalized tables
    this.version(2).stores(this.mergeVectorTileStores({
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      buildSessionConfigs: '&nodeId',
      buildSessionHeartbeats: '&nodeId',
      buildSessionStatuses: '&nodeId, status',
      buildStageStatuses: '&id, nodeId, [nodeId+stage], [nodeId+startedAt]',
    })).upgrade(async (tx) => {
      // Migration logic: Transform old BuildSessionRecord into four new tables
      // Check if the old sessions table exists (it won't exist on fresh installs)
      const tableNames = Array.from(tx.idbtrans.objectStoreNames);
      if (!tableNames.includes('sessions')) {
        // No old sessions table to migrate (fresh install or already migrated)
        return;
      }

      const oldSessionsTable = tx.idbtrans.objectStore('sessions');
      const oldSessions: BuildSessionRecord[] = [];
      const cursorRequest = oldSessionsTable.openCursor();

      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            oldSessions.push(cursor.value as BuildSessionRecord);
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });

      // Transform each old session into four new table records
      for (const old of oldSessions) {
        // 1. Create BuildSessionRecord (immutable config)
        const sessionConfig: BuildSessionRecord = {
          nodeId: old.nodeId,
          domainType: 'shape', // ShapeDB is always 'shape' domain
          selectedArrayByCountries: old.selectedArrayByCountries,
          selectedArrayVersion: undefined, // Not present in old schema
          startedAt: old.startedAt,
          sourceStageMaxima: old.sourceStageMaxima ? {
            featureMax: old.sourceStageMaxima.featureMax,
            polygonMax: old.sourceStageMaxima.polygonMax,
          } : undefined,
        };
        await tx.table('buildSessionConfigs').add(sessionConfig);

        // Discarded fields (as per design):
        // - progress: Computed from buildTasks
        // - stages: Computed from buildTasks
        // - resourceUsage: Unused/unimplemented
        // - canResume: Unused/unimplemented
        // - lastActivity: Redundant with lastHeartbeatAt
        // - expiresAt: Unused/unimplemented
        // - updatedAt: Redundant with status-specific timestamps
        // - stageHeartbeatAt: Redundant with lastHeartbeatAt
      }
    });

    this.initVectorTileTables();
    this.tileSummaries = this.table('tileSummaries');
    this.tabularMetadata = this.table('tabularMetadata');

    // Initialize new session tables
    this.buildSessionConfigs = this.table('buildSessionConfigs');
    this.buildSessionHeartbeats = this.table('buildSessionHeartbeats');
    this.buildSessionStatuses = this.table('buildSessionStatuses');
    this.buildStageStatuses = this.table('buildStageStatuses');
  }

  protected mergeVectorTileStores(stores: Record<string, string>): Record<string, string> {
    return {
      ...stores,
      featureMetadata: '&id, nodeId',
      sourceMetadata: '&id, nodeId',
      tabularMetadata: '&id, contentHash, filename, createdAt, *referencingPlugins',
    };
  }

  // Vector Tile Management
  async storeVectorTile(tile: VectorTileRecord): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const existing = await this.vectorTiles.get(tile.tileId);
      await this.vectorTiles.put(tile);
      const summary = await this.tileSummaries.get(tile.nodeId);
      const baseTiles = summary?.tiles ?? 0;
      const baseBytes = summary?.totalBytes ?? 0;
      const tiles = existing ? baseTiles : baseTiles + 1;
      const totalBytes = baseBytes - (existing?.size ?? 0) + tile.size;
      const zoomMin = summary?.zoomMin === undefined ? tile.z : Math.min(summary.zoomMin, tile.z);
      const zoomMax = summary?.zoomMax === undefined ? tile.z : Math.max(summary.zoomMax, tile.z);
      await this.tileSummaries.put({
        nodeId: tile.nodeId,
        tiles,
        totalBytes: Math.max(0, totalBytes),
        zoomMin,
        zoomMax,
        updatedAt: Date.now(),
      });
    });
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const existing = await this.vectorTiles.get(tileId);
      if (!existing) return;
      await this.vectorTiles.delete(tileId);
      const summary = await this.tileSummaries.get(existing.nodeId);
      if (!summary) return;
      const nextTiles = Math.max(0, summary.tiles - 1);
      const nextBytes = Math.max(0, summary.totalBytes - existing.size);
      if (nextTiles === 0) {
        await this.tileSummaries.delete(existing.nodeId);
        return;
      }
      let zoomMin = summary.zoomMin;
      let zoomMax = summary.zoomMax;
      if (existing.z === summary.zoomMin || existing.z === summary.zoomMax) {
        const remaining = await this.vectorTiles.where('nodeId').equals(existing.nodeId).toArray();
        const zoomLevels = remaining.map((tile) => tile.z);
        zoomMin = zoomLevels.length > 0 ? Math.min(...zoomLevels) : undefined;
        zoomMax = zoomLevels.length > 0 ? Math.max(...zoomLevels) : undefined;
      }
      await this.tileSummaries.put({
        nodeId: existing.nodeId,
        tiles: nextTiles,
        totalBytes: nextBytes,
        zoomMin,
        zoomMax,
        updatedAt: Date.now(),
      });
    });
  }

  async deleteVectorTilesByNode(nodeId: ShapeContainerNodeId): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
      await this.tileSummaries.delete(nodeId);
    });
  }

  async deleteVectorTilesByNodeIds(nodeIds: ShapeContainerNodeId[]): Promise<void> {
    if (nodeIds.length === 0) return;
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      await this.vectorTiles.where('nodeId').anyOf(nodeIds).delete();
      await this.tileSummaries.where('nodeId').anyOf(nodeIds).delete();
    });
  }

  async getVectorTileSummary(nodeId: ShapeContainerNodeId): Promise<ShapeTileSummaryRecord | undefined> {
    return await this.tileSummaries.get(nodeId);
  }

  async rebuildVectorTileSummary(nodeId: ShapeContainerNodeId): Promise<void> {
    await this.transaction('rw', [this.vectorTiles, this.tileSummaries], async () => {
      const tiles = await this.vectorTiles.where('nodeId').equals(nodeId).toArray();
      if (tiles.length === 0) {
        await this.tileSummaries.delete(nodeId);
        return;
      }
      const totalBytes = tiles.reduce((sum, tile) => sum + tile.size, 0);
      const zoomLevels = tiles.map((tile) => tile.z);
      await this.tileSummaries.put({
        nodeId,
        tiles: tiles.length,
        totalBytes,
        zoomMin: Math.min(...zoomLevels),
        zoomMax: Math.max(...zoomLevels),
        updatedAt: Date.now(),
      });
    });
  }

  async getVectorTile(
    nodeId: ShapeContainerNodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<VectorTileRecord | undefined> {
    const tile = await this.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).first();

    if (tile) {
      // Update last accessed time
      await this.vectorTiles.update(tile.tileId, {
        lastAccessed: Date.now(),
      });
    }

    return tile;
  }

  async getTilesInZoomRange(
    nodeId: ShapeContainerNodeId,
    minZ: number,
    maxZ: number,
  ): Promise<VectorTileRecord[]> {
    return await this.vectorTiles
      .where('nodeId')
      .equals(nodeId)
      .filter((tile) => tile.z >= minZ && tile.z <= maxZ)
      .toArray();
  }

}

let shapeDatabase: ShapeDB | null = null;

export function initializeShapeDB(databaseName: string): ShapeDB {
  if (typeof databaseName !== 'string' || databaseName.length === 0) {
    throw new Error('shape-database-name-required');
  }
  if (shapeDatabase === null) {
    shapeDatabase = new ShapeDB(databaseName);
  }
  if (shapeDatabase.name !== databaseName) {
    throw new Error('shape-database-name-mismatch');
  }
  return shapeDatabase;
}

export function getShapeDB(): ShapeDB {
  if (shapeDatabase === null) {
    throw new Error('shape-database-not-initialized');
  }
  return shapeDatabase;
}

const createShapeDatabaseReference = (): ShapeDB => new Proxy({} as ShapeDB, {
  get: (_target, property) => {
    const database = getShapeDB();
    const value = Reflect.get(database, property, database) as unknown;
    return typeof value === 'function' ? value.bind(database) : value;
  },
  set: (_target, property, value) => Reflect.set(getShapeDB(), property, value),
});

/** Stable reference backed only by an explicitly initialized database. */
export const shapeDB = createShapeDatabaseReference();

export async function clearShapeDatabases(databaseName: string): Promise<void> {
  if (typeof databaseName !== 'string' || databaseName.length === 0) {
    throw new Error('shape-database-name-required');
  }
  await Dexie.delete(databaseName);
}
