import { type Table, Dexie } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type RouteVectorTileRecord = {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  hash?: string;
  timestamp?: number;
  contentType?: string;
};

export type RouteSessionRecord = {
  sessionId: string;
  nodeId: NodeId;
  bbox?: [number, number, number, number];
  zoomMin?: number;
  zoomMax?: number;
  totalLines?: number;
  createdAt?: number;
  updatedAt?: number;
  status?: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  tableId?: string;
};

class EphemeralRouteDexie extends Dexie {
  vectorTiles!: Table<RouteVectorTileRecord, string>;
  sessions!: Table<RouteSessionRecord, string>;

  constructor(dbName = 'hdb-ephemeral-route') {
    super(dbName);
    this.version(1).stores({
      vectorTiles: '&id, sessionId, nodeId, [sessionId+z+x+y], timestamp',
      sessions: '&sessionId, nodeId, status, createdAt, updatedAt',
    });
  }
}

let dbInstance: EphemeralRouteDexie | null = null;

export const getEphemeralRouteDB = (): EphemeralRouteDexie => {
  if (!dbInstance) {
    dbInstance = new EphemeralRouteDexie();
  }
  return dbInstance;
};

export const clearVectorTilesForSession = async (sessionId: string): Promise<void> => {
  const db = getEphemeralRouteDB();
  await db.vectorTiles.where('sessionId').equals(sessionId).delete();
};

export const clearExpiredVectorTiles = async (ttlMs: number): Promise<void> => {
  const db = getEphemeralRouteDB();
  const cutoff = Date.now() - ttlMs;
  await db.vectorTiles.where('timestamp').below(cutoff).delete();
};
