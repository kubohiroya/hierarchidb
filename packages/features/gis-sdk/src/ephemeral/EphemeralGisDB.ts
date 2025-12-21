import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type EphemeralStage = 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';

export interface RawFeatureBuffer {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface SimplifiedFeatureBuffer {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  stage: 'simplify1' | 'simplify2';
  data: ArrayBuffer;
  featureCount: number;
  simplificationRatio: number;
  tolerance: number;
  timestamp: number;
}

export interface VectorTileData {
  id: string;
  sessionId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  hash: string;
  size: number;
  featureCount: number;
  timestamp: number;
  contentType: string;
}

export interface BatchSessionMetadata<Config = unknown> {
  id: string;
  nodeId: NodeId;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stage: EphemeralStage;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  startTime: number;
  endTime?: number;
  config: Config;
  tableId?: string;
}

export interface ProcessingCache {
  key: string;
  data: ArrayBuffer | string;
  type: 'raw' | 'simplified' | 'tile';
  size: number;
  lastAccessed: number;
  ttl: number;
}

export class EphemeralGisDB<Config = unknown> extends Dexie {
  rawBuffers!: Table<RawFeatureBuffer>;
  simplifiedBuffers!: Table<SimplifiedFeatureBuffer>;
  vectorTiles!: Table<VectorTileData>;
  sessions!: Table<BatchSessionMetadata<Config>>;
  cache!: Table<ProcessingCache>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      rawBuffers: '&id, sessionId, nodeId, timestamp',
      simplifiedBuffers: '&id, sessionId, nodeId, stage, timestamp',
      vectorTiles: '&id, sessionId, nodeId, [z+x+y], hash, timestamp',
      sessions: '&id, nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
    });
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.simplifiedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      await this.rawBuffers.where('sessionId').equals(sessionId).delete();
      await this.simplifiedBuffers.where('sessionId').equals(sessionId).delete();
      await this.vectorTiles.where('sessionId').equals(sessionId).delete();
      await this.sessions.where('id').equals(sessionId).delete();

      const cacheKeys = await this.cache
        .filter(entry => entry.key.includes(sessionId))
        .primaryKeys();
      await this.cache.bulkDelete(cacheKeys);
    });
  }

  async hasStageData(sessionId: string, stage: EphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'download':
        return (await this.rawBuffers.where('sessionId').equals(sessionId).count()) > 0;
      case 'simplify1':
      case 'simplify2':
        return (
          (await this.simplifiedBuffers.where({ sessionId, stage }).count()) > 0
        );
      case 'vectorTiles':
        return (await this.vectorTiles.where('sessionId').equals(sessionId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(sessionId: string, stage: EphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.simplifiedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      switch (stage) {
        case 'download':
          await this.rawBuffers.where('sessionId').equals(sessionId).delete();
          break;
        case 'simplify1':
        case 'simplify2':
          await this.simplifiedBuffers.where({ sessionId, stage }).delete();
          break;
        case 'vectorTiles':
          await this.vectorTiles.where('sessionId').equals(sessionId).delete();
          break;
        default:
          break;
      }

      await this.sessions.where('id').equals(sessionId).delete();

      const cacheKeys = await this.cache
        .filter(entry => entry.key.includes(sessionId))
        .primaryKeys();
      await this.cache.bulkDelete(cacheKeys);
    });
  }

  async clearExpiredCache(): Promise<number> {
    const now = Date.now();
    const expired = await this.cache
      .filter(entry => entry.lastAccessed + entry.ttl < now)
      .toArray();

    if (expired.length > 0) {
      await this.cache.bulkDelete(expired.map(entry => entry.key));
    }

    return expired.length;
  }

  async getStatistics(): Promise<{
    rawBuffers: number;
    simplifiedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }> {
    const [rawCount, simplifiedCount, tileCount, sessionCount, cacheCount] = await Promise.all([
      this.rawBuffers.count(),
      this.simplifiedBuffers.count(),
      this.vectorTiles.count(),
      this.sessions.count(),
      this.cache.count(),
    ]);

    let totalSize = 0;

    const rawBuffers = await this.rawBuffers.toArray();
    totalSize += rawBuffers.reduce((sum, buffer) => sum + (buffer.size || 0), 0);

    const tiles = await this.vectorTiles.toArray();
    totalSize += tiles.reduce((sum, tile) => sum + tile.size, 0);

    const cacheEntries = await this.cache.toArray();
    totalSize += cacheEntries.reduce((sum, entry) => sum + entry.size, 0);

    return {
      rawBuffers: rawCount,
      simplifiedBuffers: simplifiedCount,
      vectorTiles: tileCount,
      sessions: sessionCount,
      cacheEntries: cacheCount,
      totalSize,
    };
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.simplifiedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      await Promise.all([
        this.rawBuffers.clear(),
        this.simplifiedBuffers.clear(),
        this.vectorTiles.clear(),
        this.sessions.clear(),
        this.cache.clear(),
      ]);
    });
  }
}
