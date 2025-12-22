/**
 * EphemeralLocationDB - temporary storage for Location plugin artifacts
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId, Timestamp } from '@hierarchidb/common-types';
import type { LocationBatchData, UnifiedLocationBatchConfig } from '../common/types/batch-types.js';

export interface VectorTileRecord {
  id: string; // tileKey, e.g. loc-mvt-<sessionId>-<z>-<x>-<y>
  sessionId: string;
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

export interface LocationSessionRecord {
  sessionId: string;
  nodeId: NodeId;
  bbox: [number, number, number, number];
  zoomMin: number;
  zoomMax: number;
  totalPoints: number;
  createdAt: number;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  tableId?: string;
  progress?: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    currentStage?: string;
    currentTask?: string;
  };
  updatedAt?: number;
  config?: UnifiedLocationBatchConfig;
}

export interface PendingLocationSession {
  nodeId: NodeId;
  points: LocationBatchData['points'];
  settings: LocationBatchData['settings'];
  config?: UnifiedLocationBatchConfig;
  storedAt: Timestamp;
}

export class EphemeralLocationDB extends Dexie {
  vectorTiles!: Table<VectorTileRecord>;
  sessions!: Table<LocationSessionRecord>;
  pendingSessions!: Table<PendingLocationSession>;

  constructor() {
    super(getDBName('location-ephemeral'));
    this.version(1).stores({
      vectorTiles: '&id, sessionId, nodeId, [z+x+y], timestamp',
    });
    this.version(2).stores({
      sessions: '&sessionId, nodeId, createdAt, status',
    });
    // v3: add optional tableId for tabular-source (column-wise) search linkage
    this.version(3).upgrade(async () => {
      // No index changes needed; keep shape and allow nullable field
      // Existing sessions will simply not have tableId
    });

    this.version(4).stores({
      pendingSessions: '&nodeId, storedAt',
    });

    this.vectorTiles = this.table('vectorTiles');
    this.sessions = this.table('sessions');
    this.pendingSessions = this.table('pendingSessions');
  }

  async clearSession(sessionId: string) {
    await this.clearVectorTilesForSession(sessionId);
    if (this.sessions) await this.sessions.where('sessionId').equals(sessionId).delete();
  }

  async clearExpiredSessions(ttlMs: number): Promise<number> {
    if (!this.sessions) return 0;
    const threshold = Date.now() - ttlMs;
    const old = await this.sessions.where('createdAt').below(threshold).toArray();
    if (old.length === 0) return 0;
    const sessionIds = old.map(s => s.sessionId);
    await this.transaction('rw', this.sessions, this.vectorTiles, async () => {
      await this.sessions.bulkDelete(sessionIds);
      for (const id of sessionIds) {
        await this.vectorTiles.where('sessionId').equals(id).delete();
      }
    });
    return sessionIds.length;
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
    await this.transaction('rw', this.sessions, this.vectorTiles, this.pendingSessions, async () => {
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
      if (this.sessions) await this.sessions.where('nodeId').equals(nodeId).delete();
      if (this.pendingSessions) await this.pendingSessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async clearVectorTilesForSession(sessionId: string): Promise<void> {
    await this.vectorTiles.where('sessionId').equals(sessionId).delete();
  }
}

let singleton: EphemeralLocationDB | null = null;

export function getEphemeralLocationDB(): EphemeralLocationDB {
  if (!singleton) singleton = new EphemeralLocationDB();
  return singleton;
}

export async function closeEphemeralLocationDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}
