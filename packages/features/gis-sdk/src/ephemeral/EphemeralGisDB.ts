import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type EphemeralStage = 'fetch' | 'transform-by-band' | 'transform-by-zoom' | 'vt';

export interface FetchCacheRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface TransformByBandCacheRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  timestamp: number;
}

export interface TransformByZoomCacheRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  timestamp: number;
}

export interface VTCacheRecord {
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

export class EphemeralGisDB<Config = unknown> extends Dexie {
  fetchCache!: Table<FetchCacheRecord>;
  transformByBandCache!: Table<TransformByBandCacheRecord>;
  transformByZoomCache!: Table<TransformByZoomCacheRecord>;
  vtCache!: Table<VTCacheRecord>;
  sessions!: Table<BatchSessionMetadata<Config>>;

  constructor(name: string) {
    super(name);
    this.version(3)
      .stores({
        fetchCache: '&id, nodeId, timestamp',
        transformByBandCache: '&id, nodeId, timestamp',
        transformByZoomCache: '&id, nodeId, timestamp',
        vtCache: '&id, nodeId, [z+x+y], hash, timestamp',
        sessions: '&nodeId, status, stage, startTime'
      })
      .upgrade(async () => {
        await this.fetchCache.clear();
        await this.transformByBandCache.clear();
        await this.transformByZoomCache.clear();
        await this.vtCache.clear();
        await this.sessions.clear();
      });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformByBandCache,
      this.transformByZoomCache,
      this.vtCache,
      this.sessions
    ], async () => {
      await this.fetchCache.where('nodeId').equals(nodeId).delete();
      await this.transformByBandCache.where('nodeId').equals(nodeId).delete();
      await this.transformByZoomCache.where('nodeId').equals(nodeId).delete();
      await this.vtCache.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: NodeId, stage: EphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'fetch':
        return (await this.fetchCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform-by-band':
        return (await this.transformByBandCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform-by-zoom':
        return (await this.transformByZoomCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'vt':
        return (await this.vtCache.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: EphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformByBandCache,
      this.transformByZoomCache,
      this.vtCache,
      this.sessions,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform-by-band':
          await this.transformByBandCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform-by-zoom':
          await this.transformByZoomCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'vt':
          await this.vtCache.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }

      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformByBandCaches: number;
    numTransformByZoomCaches: number;
    numVtCaches: number;
    numSessions: number;
    totalSize: number
  }> {
    const [numFetchCaches, numTransformByBandCaches, numTransformByZoomCaches, numVtCaches, numSessions] = await Promise.all([
      this.fetchCache.count(),
      this.transformByBandCache.count(),
      this.transformByZoomCache.count(),
      this.vtCache.count(),
      this.sessions.count()
    ]);

    let totalSize = 0;

    const rawBuffers = await this.fetchCache.toArray();
    totalSize += rawBuffers.reduce((sum, buffer) => sum + (buffer.size || 0), 0);

    const tiles = await this.vtCache.toArray();
    totalSize += tiles.reduce((sum, tile) => sum + tile.size, 0);

    return {
      numFetchCaches,
      numTransformByBandCaches,
      numTransformByZoomCaches,
      numVtCaches,
      numSessions,
      totalSize,
    };
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformByBandCache,
      this.transformByZoomCache,
      this.vtCache,
      this.sessions,
    ], async () => {
      await Promise.all([
        this.fetchCache.clear(),
        this.transformByBandCache.clear(),
        this.transformByZoomCache.clear(),
        this.vtCache.clear(),
        this.sessions.clear()
      ]);
    });
  }
}
