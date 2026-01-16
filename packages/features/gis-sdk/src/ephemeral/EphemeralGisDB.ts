import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type EphemeralStage = 'fetch' | 'transform' | 'transform-by-zoom' | 'vt';

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

export interface TransformCacheRecord {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  timestamp: number;
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
  transformCache!: Table<TransformCacheRecord>;
  sessions!: Table<BatchSessionMetadata<Config>>;

  constructor(name: string) {
    super(name);
    this.version(4)
      .stores({
        fetchCache: '&id, nodeId, timestamp',
        transformCache: '&id, nodeId, timestamp',
        sessions: '&nodeId, status, stage, startTime'
      })
      .upgrade(async () => {
        await this.fetchCache.clear();
        await this.transformCache.clear();
        await this.sessions.clear();
      });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions
    ], async () => {
      await this.fetchCache.where('nodeId').equals(nodeId).delete();
      await this.transformCache.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: NodeId, stage: EphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'fetch':
        return (await this.fetchCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform':
        return (await this.transformCache.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: EphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformCache.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }

      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformCaches: number;
    numSessions: number;
    totalSize: number
  }> {
    const [numFetchCaches, numTransformCaches, numSessions] = await Promise.all([
      this.fetchCache.count(),
      this.transformCache.count(),
      this.sessions.count()
    ]);

    let totalSize = 0;

    const rawBuffers = await this.fetchCache.toArray();
    totalSize += rawBuffers.reduce((sum, buffer) => sum + (buffer.size || 0), 0);

    return {
      numFetchCaches,
      numTransformCaches,
      numSessions,
      totalSize,
    };
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions,
    ], async () => {
      await Promise.all([
        this.fetchCache.clear(),
        this.transformCache.clear(),
        this.sessions.clear()
      ]);
    });
  }
}
