/**
 * ShapeDB - Main database for shape-plugin plugin using Dexie
 *
 * Manages all persistent data for the shapes plugin including:
 * - Shape entities and metadata
 * - Feature indices
 * - Vector tiles
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import type { Geometry } from 'geojson';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import type { TabularTableMetadataLike } from '@hierarchidb/tabular-store';
import type {
  FeatureFilterMethod, SourceConfig,
  HybridFilterConfig, GeometryConfig, TileEmitConfig } from '@hierarchidb/gis-sdk';
import type {
  BuildSessionRecord as NewBuildSessionRecord,
  BuildSessionHeartbeat,
  BuildSessionStatus,
  BuildStageStatus,
} from '@hierarchidb/gis-sdk';

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'geoboundaries-topojson' | 'gadm' | 'openstreetmap';

export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

export interface BuildSessionConfig extends CommonSessionConfig {
  sourceConfig: SourceConfig;
  geometryConfig: GeometryConfig;
  vectorTiles: TileEmitConfig;
  quantize?: number;
  extract?: number;
  tolerance?: number;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  enableFeatureFiltering?: boolean;
  enablePerFeatureExtraction?: boolean;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteDownloadCacheOnComplete?: boolean;
  deleteExtract1CacheOnComplete?: boolean;
  deleteExtract2CacheOnComplete?: boolean;
}

export type BuildProcessConfig = BuildSessionConfig;
export type BuildTaskType = 'source' | 'geometry' | 'tileEmit';
export type BuildStage = BuildTaskType;
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'recycled';

export type TaskDisplayKind = 'phase' | 'summary' | 'skip' | 'error' | 'info';

export type TaskDisplayMetric = {
  input: number;
  output: number;
};

export type TaskDisplayPayload = {
  kind: TaskDisplayKind;
  key?: string;
  params?: Record<string, string | number | boolean>;
  phaseCode?: string;
  phaseState?: 'start' | 'progress' | 'done';
  metrics?: Partial<Record<'features' | 'polygons' | 'vertices', TaskDisplayMetric>>;
};

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: BuildStage | 'processing';
}

export interface StageStatus {
  status: TaskStatus;
  progress: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  message?: string;
}

export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

export type BuildStopReason = 'route-leave' | 'user-pause' | 'failed' | 'completed' | 'unknown';

export interface LayerInfo {
  name: string;
  featureCount: number;
  minZoom: number;
  maxZoom: number;
  fields: string[];
}

export interface SourceStageMaxima {
  featureMax: number;
  polygonMax: number;
}

/**
 * @deprecated Legacy BuildSessionRecord - kept for migration from version 1 to version 2
 * Use the new four-table structure instead:
 * - BuildSessionRecord (immutable config)
 * - BuildSessionHeartbeat (heartbeat tracking)
 * - BuildSessionStatus (session status)
 * - BuildStageStatus (per-stage tracking)
 */
export interface BuildSessionRecord {
  nodeId: ShapeContainerNodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  selectedArrayByCountries?: Record<string, boolean[]>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  progress: ProgressInfo;
  stages: Record<BuildStage, StageStatus>;
  resourceUsage?: ResourceUsage;
  stopReason?: BuildStopReason;
  canResume?: boolean;
  lastActivity?: number;
  expiresAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  stageInactiveMs?: number;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageId?: string;
  elapsedMs?: number;
  elapsedByStage?: Record<string, number>;
  sourceStageMaxima?: SourceStageMaxima;
  stage?: BuildStage;
}

export type SourceTaskPayload = {
  url?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  endpoint?: string;
  bbox?: [number, number, number, number];
  tags?: Array<
    | string
    | {
      key: string;
      value?: string;
      operator?: 'eq' | 'ne' | 'exists' | 'not_exists';
      includeNodes?: boolean;
    }
  >;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
};

export type SourceTaskResult = {
  outputBufferId?: string;
  bytesWritten?: number;
  featureCount?: number;
};

export type TransformByBandTaskPayload = {
  inputBufferId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
};

export type TransformByBandTaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
};

export type TransormByZoomTaskPayload = {
  inputBufferId?: string;
  sourceTaskId?: string;
  sourceUrl?: string;
  featureId?: string;
  featureLabel?: string;
  featureGroupId?: string;
  featureIndex?: number;
  originKey?: string;
  originLabel?: string;
  adminCode?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  adminLevel?: number;
  continent?: string;
  countryName?: string;
  zoomLevels?: number[];
  zoomRange?: [number, number];
  zoomRangeLabel?: string;
  tolerance?: number;
};

export type TransformByZoomTaskResult = {
  outputBufferId?: string;
  featureCount?: number;
  extractionRatio?: number;
  retry?: number;
};

export type TileEmitTaskPayload = {
  inputBufferId: string;
  tileZ?: number;
  tileX?: number;
  tileY?: number;
  extent?: number;
  tileSize?: number;
  buffer?: number;
  compression?: boolean;
  format?: 'mvt' | 'pbf';
  layers?: unknown[];
  outputBufferId?: string;
  dataSource?: DataSourceName;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: {
    dataSource?: string;
    countryCode?: string;
    countryName?: string;
    adminLevel?: number;
  };
};

export type TileEmitTaskResult = {
  tileId: string;
  tileCount?: number;
  totalBytes?: number;
  retry?: number;
};

export type ShapeBuildTaskPayload =
  | SourceTaskPayload
  | TransformByBandTaskPayload
  | TransormByZoomTaskPayload
  | TileEmitTaskPayload;

export type ShapeBuildTaskResult =
  | SourceTaskResult
  | TransformByBandTaskResult
  | TransformByZoomTaskResult
  | TileEmitTaskResult;

export interface BuildTaskRecord<TInput = ShapeBuildTaskPayload, TOutput = ShapeBuildTaskResult> {
  taskId: string;
  nodeId: ShapeContainerNodeId;
  stage: BuildTaskType;
  status: TaskStatus;
  index: number;
  progress: number;
  taskType?: never;
  display?: TaskDisplayPayload;
  message?: string;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
}

export type ShapeContainerNodeId = NodeId;

export interface ShapeFeature {
  id: number;
  nodeId: ShapeContainerNodeId;
  properties: Record<string, unknown>;
  geometry: Geometry; // GeoJSON.Geometry
  bbox?: [number, number, number, number];
  mortonCode?: bigint;
  adminLevel?: number;
  countryCode?: string;
  name?: string;
  nameEn?: string;
  population?: number;
  area?: number;
  extractionLevel?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShapeFeatureBuffer {
  bufferId: string;
  nodeId: ShapeContainerNodeId;
  stage: BuildStage;
  data_Uint8Array: Uint8Array;
  format: 'geojson' | 'topojson' | 'geobuf' | 'flatgeobuf';
  featureCount: number;
  byteSize: number;
  compression?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface VectorTileRecord {
  tileId: string;
  nodeId: ShapeContainerNodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  layers: LayerInfo[];
  generatedAt: number;
  lastAccessed?: number;
  contentHash: string;
  contentEncoding?: 'gzip' | 'br';
  version: number;
}

export interface ShapeTileSummaryRecord {
  nodeId: ShapeContainerNodeId;
  tiles: number;
  totalBytes: number;
  zoomMin?: number;
  zoomMax?: number;
  updatedAt: number;
}

export class ShapeDB extends VectorTileDbBase {

  // Tile storage tables
  vectorTiles!: Table<VectorTileRecord, string>;
  tileSummaries!: Table<ShapeTileSummaryRecord, ShapeContainerNodeId>;
  tabularMetadata!: Table<TabularTableMetadataLike, string>;

  // New session tables (version 2)
  buildSessions!: Table<NewBuildSessionRecord, NodeId>;
  buildSessionHeartbeats!: Table<BuildSessionHeartbeat, NodeId>;
  buildSessionStatuses!: Table<BuildSessionStatus, NodeId>;
  buildStageStatuses!: Table<BuildStageStatus, string>;

  constructor() {
    super(getDBName('shape'));

    // Version 1: Original schema with monolithic sessions table
    this.version(1).stores(this.mergeVectorTileStores({
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
    }));

    // Version 2: Refactored session schema with four normalized tables
    this.version(2).stores(this.mergeVectorTileStores({
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      tileSummaries: '&nodeId',
      buildSessions: '&nodeId',
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
        const sessionConfig: NewBuildSessionRecord = {
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
        await tx.table('buildSessions').add(sessionConfig);

        // 2. Create BuildSessionHeartbeat (if lastHeartbeatAt exists)
        if (old.lastHeartbeatAt !== undefined) {
          const heartbeat: BuildSessionHeartbeat = {
            nodeId: old.nodeId,
            lastHeartbeatAt: old.lastHeartbeatAt,
          };
          await tx.table('buildSessionHeartbeats').add(heartbeat);
        }

        // 3. Create BuildSessionStatus (session-level status)
        const sessionStatus: BuildSessionStatus = {
          nodeId: old.nodeId,
          status: old.status,
          stopReason: old.stopReason,
          completedAt: old.completedAt,
        };
        await tx.table('buildSessionStatuses').add(sessionStatus);

        // 4. Create BuildStageStatus (current stage only - historical data lost)
        // Note: Old schema only stored current stage, so we can only migrate that
        if (old.stage) {
          const stageStatus: BuildStageStatus = {
            id: `${old.nodeId}:${old.stage}`,
            nodeId: old.nodeId,
            stage: old.stage,
            status: old.status === 'running' ? 'running' : 'completed', // Infer from session status
            startedAt: old.stageStartedAt ?? old.startedAt,
            completedAt: old.status === 'completed' ? old.completedAt : undefined,
            inactiveMs: old.stageInactiveMs,
            stageId: old.stageId,
          };
          await tx.table('buildStageStatuses').add(stageStatus);
        }

        // Discarded fields (as per design):
        // - progress: Computed from buildTasks
        // - stages: Computed from buildTasks
        // - resourceUsage: Unused/unimplemented
        // - canResume: Unused/unimplemented
        // - lastActivity: Redundant with lastHeartbeatAt
        // - expiresAt: Unused/unimplemented
        // - updatedAt: Redundant with status-specific timestamps
        // - elapsedMs: Computed from startedAt
        // - elapsedByStage: Computed from BuildStageStatus records
        // - stageHeartbeatAt: Redundant with lastHeartbeatAt
      }
    });

    this.initVectorTileTables();
    this.tileSummaries = this.table('tileSummaries');
    this.tabularMetadata = this.table('tabularMetadata');
    
    // Initialize new session tables
    this.buildSessions = this.table('buildSessions');
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

// Aligned alias for cross-plugin naming consistency.
// export { ShapeDB as ShapeDatabase };

// Singleton instance
export const shapeDB = new ShapeDB();

export async function clearShapeDatabases(): Promise<void> {
  await Dexie.delete(getDBName('shape'));
}
