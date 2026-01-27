/**
 * LocationDB - storage for Location plugin artifacts
 */

import type { Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import { VectorTileDbBase } from '@hierarchidb/vectortile-store';
import type {
  LocationBatchData,
  LocationGroupItemData,
  LocationRelationMeta,
  UnifiedLocationBatchConfig,
} from './index.js';

export type LocationFeatureRow = {
  nodeId: NodeId;
  id: string;
  type?: string;
  mortonKey?: string;
  data?: LocationGroupItemData;
  updatedAt?: number;
};

export type LocationRelationRow = {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number;
};

export interface VectorTileRecord {
  id: string; // tileKey, e.g. loc-mvt-<nodeId>-<z>-<x>-<y>
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer; // MVT PBF
  hash: string;
  size: number;
  featureCount: number;
  timestamp: number;
  contentType: 'application/vnd.mapbox-vector-tile';
}


export interface PendingLocationSession {
  nodeId: NodeId;
  points: LocationBatchData['points'];
  settings: LocationBatchData['settings'];
  config?: UnifiedLocationBatchConfig;
  storedAt: Timestamp;
}

export class LocationDB extends VectorTileDbBase {
  features!: Table<LocationFeatureRow, [NodeId, string]>;
  relations!: Table<LocationRelationRow, [NodeId, string, NodeId]>;
  vectorTiles!: Table<VectorTileRecord>;
  pendingSessions!: Table<PendingLocationSession>;

  constructor() {
    super(getDBName('location'));
    this.version(1).stores({
      vectorTiles: '&id, sessionId, nodeId, [z+x+y], timestamp',
    });

    this.version(4).stores({
      pendingSessions: '&nodeId, storedAt',
    });

    this.version(5)
      .stores({
        vectorTiles: '&id, nodeId, [z+x+y], timestamp',
        pendingSessions: '&nodeId, storedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('vectorTiles').clear();
      });

    this.version(6)
      .stores({
        features: '&[nodeId+id], nodeId, id, updatedAt',
        relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
        vectorTiles: '&id, nodeId, [z+x+y], timestamp',
        pendingSessions: '&nodeId, storedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('features').clear();
        await tx.table('relations').clear();
        await tx.table('vectorTiles').clear();
        await tx.table('pendingSessions').clear();
        try {
          await tx.table('groupEntities').clear();
        } catch {
          // Ignore missing legacy tables
        }
      });

    this.version(7).stores(this.mergeVectorTileStores({
      features: '&[nodeId+id], nodeId, id, updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    }));

    this.version(8).stores(this.mergeVectorTileStores({
      features: '&[nodeId+id], nodeId, id, kind, mortonKey, [nodeId+mortonKey], [nodeId+kind+mortonKey], updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    })).upgrade(async (tx) => {
      await tx.table('features').clear();
      await tx.table('vectorTiles').clear();
    });

    
    this.version(9).stores(this.mergeVectorTileStores({
      features: '&[nodeId+id], nodeId, id, type, mortonKey, [nodeId+mortonKey], [nodeId+type+mortonKey], updatedAt',
      relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt',
      vectorTiles: '&id, nodeId, [z+x+y], timestamp',
      pendingSessions: '&nodeId, storedAt',
    })).upgrade(async (tx) => {
      await tx.table('features').clear();
      await tx.table('vectorTiles').clear();
    });

this.features = this.table('features');
    this.relations = this.table('relations');
    this.vectorTiles = this.table('vectorTiles');
    this.pendingSessions = this.table('pendingSessions');
    this.initVectorTileTables();
  }

  async clearExpiredPendingSessions(ttlMs: number): Promise<number> {
    const threshold = Date.now() - ttlMs;
    const collection = this.pendingSessions.where('storedAt').below(threshold);
    return collection.delete();
  }

  async clearExpiredVectorTiles(ttlMs: number): Promise<number> {
    const threshold = Date.now() - ttlMs;
    const collection = this.vectorTiles.where('timestamp').below(threshold);
    return collection.delete();
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [this.features, this.relations, this.vectorTiles, this.pendingSessions], async () => {
      await this.features.where('nodeId').equals(nodeId).delete();
      await this.relations.where('srcNodeId').equals(nodeId).delete();
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
      if (this.pendingSessions) await this.pendingSessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async clearVectorTilesForNode(nodeId: NodeId): Promise<void> {
    await this.vectorTiles.where('nodeId').equals(nodeId).delete();
  }
}

let singleton: LocationDB | null = null;

export function getLocationDB(): LocationDB {
  if (!singleton) singleton = new LocationDB();
  return singleton;
}

export async function closeLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

// Backward-compatible aliases (to be removed after migration window).
export { LocationDB as LocationDatabase };
export const getLocationDatabase = getLocationDB;
export const getEphemeralLocationDB = getLocationDB;
export const closeEphemeralLocationDB = closeLocationDB;
