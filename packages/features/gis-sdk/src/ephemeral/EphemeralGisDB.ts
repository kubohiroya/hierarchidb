import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type EphemeralStage = 'download' | 'extract1' | 'extract2' | 'vectorTiles';

export interface RawFeatureBuffer {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface ExtractedFeatureBuffer {
  id: string;
  nodeId: NodeId;
  stage: 'extract1' | 'extract2';
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
}

export interface VectorTileData {
  id: string;
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
  nodeId: NodeId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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
  type: 'raw' | 'extracted' | 'tile';
  size: number;
  lastAccessed: number;
  ttl: number;
}

export class EphemeralGisDB<Config = unknown> extends Dexie {
  rawBuffers!: Table<RawFeatureBuffer>;
  extractedBuffers!: Table<ExtractedFeatureBuffer>;
  vectorTiles!: Table<VectorTileData>;
  sessions!: Table<BatchSessionMetadata<Config>>;
  cache!: Table<ProcessingCache>;

  constructor(name: string) {
    super(name);
    this.version(2)
      .stores({
        rawBuffers: '&id, nodeId, timestamp',
        extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
        vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
        sessions: '&nodeId, status, stage, startTime',
        cache: '&key, type, lastAccessed, ttl',
      })
      .upgrade(async () => {
        await this.rawBuffers.clear();
        await this.extractedBuffers.clear();
        await this.vectorTiles.clear();
        await this.sessions.clear();
        await this.cache.clear();
      });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.extractedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      await this.rawBuffers.where('nodeId').equals(nodeId).delete();
      await this.extractedBuffers.where('nodeId').equals(nodeId).delete();
      await this.vectorTiles.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();

      const cacheKeys = await this.cache
        .filter(entry => entry.key.includes(String(nodeId)))
        .primaryKeys();
      await this.cache.bulkDelete(cacheKeys);
    });
  }

  async hasStageData(nodeId: NodeId, stage: EphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'download':
        return (await this.rawBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'extract1':
      case 'extract2':
        return (
          (await this.extractedBuffers.where({ nodeId, stage }).count()) > 0
        );
      case 'vectorTiles':
        return (await this.vectorTiles.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: EphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.extractedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      switch (stage) {
        case 'download':
          await this.rawBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'extract1':
        case 'extract2':
          await this.extractedBuffers.where({ nodeId, stage }).delete();
          break;
        case 'vectorTiles':
          await this.vectorTiles.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }

      await this.sessions.where('nodeId').equals(nodeId).delete();

      const cacheKeys = await this.cache
        .filter(entry => entry.key.includes(String(nodeId)))
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
    extractedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }> {
    const [rawCount, extractedCount, tileCount, sessionCount, cacheCount] = await Promise.all([
      this.rawBuffers.count(),
      this.extractedBuffers.count(),
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
      extractedBuffers: extractedCount,
      vectorTiles: tileCount,
      sessions: sessionCount,
      cacheEntries: cacheCount,
      totalSize,
    };
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.extractedBuffers,
      this.vectorTiles,
      this.sessions,
      this.cache,
    ], async () => {
      await Promise.all([
        this.rawBuffers.clear(),
        this.extractedBuffers.clear(),
        this.vectorTiles.clear(),
        this.sessions.clear(),
        this.cache.clear(),
      ]);
    });
  }
}
