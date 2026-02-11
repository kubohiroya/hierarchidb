import { type Table, Dexie } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';

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

class RouteVectorTileEphemeralDB extends Dexie {
  vectorTiles!: Table<RouteVectorTileRecord, string>;

  constructor(dbName = 'hdb-ephemeral-route') {
    super(dbName);
    this.version(1).stores({
      vectorTiles: '&id, sessionId, nodeId, [sessionId+z+x+y], timestamp',
      sessions: '&sessionId, nodeId, status, createdAt, updatedAt',
    });
    this.version(2).stores({
      vectorTiles: '&id, sessionId, timestamp',
      sessions: '&sessionId',
    });
    this.version(3).stores({
      vectorTiles: '&id, sessionId, nodeId, [sessionId+z+x+y], timestamp',
    });
  }
}

let dbInstance: RouteVectorTileEphemeralDB | null = null;

export const getEphemeralRouteVectorTileDB = (): RouteVectorTileEphemeralDB => {
  if (!dbInstance) {
    dbInstance = new RouteVectorTileEphemeralDB();
  }
  return dbInstance;
};

export const clearVectorTilesForSession = async (sessionId: string): Promise<void> => {
  const db = getEphemeralRouteVectorTileDB();
  await db.vectorTiles.where('sessionId').equals(sessionId).delete();
};

export const clearExpiredVectorTiles = async (ttlMs: number): Promise<void> => {
  const db = getEphemeralRouteVectorTileDB();
  const cutoff = Date.now() - ttlMs;
  await db.vectorTiles.where('timestamp').below(cutoff).delete();
};
