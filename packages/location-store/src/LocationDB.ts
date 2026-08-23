/**
 * LocationDB - storage for persistent Location features.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeature } from '@hierarchidb/location-api';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import { Dexie, type Table } from 'dexie';
import {
  type LocationSourceArtifactRecord,
  validateLocationSourceArtifactRecord,
} from './LocationSourceArtifactRecord.js';
import {
  buildLocationVectorTileId,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
  type LocationVectorTileRecord,
} from './LocationVectorTileRecord.js';

export class LocationDB extends VectorTileDbBase {
  declare features: Table<LocationFeature, [NodeId, string]>;
  declare vectorTiles: Table<LocationVectorTileRecord, string>;
  declare sourceArtifacts: Table<LocationSourceArtifactRecord, NodeId>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      features:
        '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
    });
    this.version(2).stores(
      this.mergeVectorTileStores({
        features:
          '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
        vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
      })
    );
    this.version(3).stores(
      this.mergeVectorTileStores({
        features:
          '&[nodeId+id], nodeId, [nodeId+mortonKey], [nodeId+type+mortonKey], centroidForShapeContainerNodeId',
        vectorTiles: '&tileId, nodeId, [nodeId+z+x+y]',
        sourceArtifacts: '&nodeId, inputHash, contentHash, completedAt',
      })
    );

    this.features = this.table('features');
    this.vectorTiles = this.table('vectorTiles');
    this.sourceArtifacts = this.table('sourceArtifacts');
    this.initVectorTileTables();
  }

  async clearNodeFeatures(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.features], async () => {
      await this.features.where('nodeId').equals(nodeId).delete();
    });
  }

  async clearNodeVectorTiles(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.vectorTiles], async () => {
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
    });
  }

  async clearNodeArtifacts(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.features, this.sourceArtifacts], async () => {
      await this.features.where('nodeId').equals(nodeId).delete();
      await this.sourceArtifacts.delete(nodeId);
    });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.clearNodeArtifacts(nodeId);
  }

  async storeVectorTile(tile: LocationVectorTileRecord): Promise<void> {
    validateLocationVectorTileRecord(tile);
    await this.vectorTiles.put(tile);
  }

  async storeSourceArtifact(record: LocationSourceArtifactRecord): Promise<void> {
    validateLocationSourceArtifactRecord(record);
    await this.sourceArtifacts.put(record);
  }

  async getVectorTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<LocationVectorTileRecord | undefined> {
    validateTileCoordinates(z, x, y);
    const tile = await this.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).first();
    if (tile === undefined) return undefined;
    validateLocationVectorTileRecord(tile);
    return tile;
  }
}

export const validateTileCoordinates = (z: number, x: number, y: number): void => {
  if (!Number.isInteger(z) || z < 0 || z > 24) {
    throw new Error('location-vector-tile-z-invalid');
  }
  const tileCount = 2 ** z;
  if (!Number.isInteger(x) || x < 0 || x >= tileCount) {
    throw new Error('location-vector-tile-x-invalid');
  }
  if (!Number.isInteger(y) || y < 0 || y >= tileCount) {
    throw new Error('location-vector-tile-y-invalid');
  }
};

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === '[object ArrayBuffer]';

export const validateLocationVectorTileRecord = (tile: LocationVectorTileRecord): void => {
  validateTileCoordinates(tile.z, tile.x, tile.y);
  if (typeof tile.tileId !== 'string' || tile.tileId.length === 0) {
    throw new Error('location-vector-tile-id-invalid');
  }
  if (tile.tileId !== buildLocationVectorTileId(tile.nodeId, tile.z, tile.x, tile.y)) {
    throw new Error('location-vector-tile-id-mismatch');
  }
  if (!isArrayBuffer(tile.data)) {
    throw new Error('location-vector-tile-data-invalid');
  }
  if (!Number.isInteger(tile.size) || tile.size !== tile.data.byteLength) {
    throw new Error('location-vector-tile-size-mismatch');
  }
  if (tile.contentType !== LOCATION_VECTOR_TILE_CONTENT_TYPE) {
    throw new Error('location-vector-tile-content-type-invalid');
  }
  if (!Number.isFinite(tile.timestamp) || tile.timestamp < 0) {
    throw new Error('location-vector-tile-timestamp-invalid');
  }
};

let singleton: LocationDB | null = null;

const requireLocationDatabaseName = (databaseName: unknown): string => {
  if (typeof databaseName !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databaseName)) {
    throw new Error('location-database-name-invalid');
  }
  return databaseName;
};

export function initializeLocationDB(databaseName: string): LocationDB {
  const exactDatabaseName = requireLocationDatabaseName(databaseName);
  if (!singleton) singleton = new LocationDB(exactDatabaseName);
  if (singleton.name !== exactDatabaseName) {
    throw new Error('location-database-name-mismatch');
  }
  return singleton;
}

export function getLocationDB(): LocationDB {
  if (!singleton) throw new Error('location-database-not-initialized');
  return singleton;
}

export async function closeLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearLocationDatabases(databaseName: string): Promise<void> {
  await Dexie.delete(requireLocationDatabaseName(databaseName));
}

export async function hasLocationReferencesToShapes(shapeNodeIds: NodeId[]): Promise<boolean> {
  if (!shapeNodeIds.length) return false;
  const db = getLocationDB();
  await db.open?.();
  const matches = await db.features
    .where('centroidForShapeContainerNodeId')
    .anyOf(shapeNodeIds)
    .limit(1)
    .toArray();
  return matches.length > 0;
}

// No ephemeral database is currently implemented for Location.
