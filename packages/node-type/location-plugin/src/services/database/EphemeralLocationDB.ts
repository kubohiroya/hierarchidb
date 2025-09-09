/**
 * EphemeralLocationDB - temporary storage for Location plugin artifacts
 */

import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-type';

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

export class EphemeralLocationDB extends Dexie {
  vectorTiles!: Table<VectorTileRecord>;
  sessions!: Table<{
    sessionId: string;
    nodeId: NodeId;
    bbox: [number, number, number, number];
    zoomMin: number;
    zoomMax: number;
    totalPoints: number;
    createdAt: number;
    status: 'running' | 'completed' | 'failed';
    tableId?: string
  }>;

  constructor() {
    super(getDBName('location-ephemeral-db'));
    this.version(1).stores({
      vectorTiles: '&id, sessionId, nodeId, [z+x+y], timestamp',
    });
    this.version(2).stores({
      sessions: '&sessionId, nodeId, createdAt, status',
    });
    // v3: add optional tableId for tabular (column-wise) search linkage
    this.version(3).upgrade(async () => {
      // No index changes needed; keep shape and allow nullable field
      // Existing sessions will simply not have tableId
    });

    this.vectorTiles = this.table('vectorTiles');
    // @ts-ignore: assigned after version(2)
    this.sessions = this.table('sessions');
  }

  async clearSession(sessionId: string) {
    await this.vectorTiles.where('sessionId').equals(sessionId).delete();
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
