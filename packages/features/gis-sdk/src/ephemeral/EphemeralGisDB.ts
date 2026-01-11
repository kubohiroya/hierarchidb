import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';

export type EphemeralStage = 'fetch' | 'transform' | 'vt';

export interface FetchFeatureBuffer {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  timestamp: number;
}

export interface TransformFeatureBuffer {
  id: string;
  nodeId: NodeId;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
}

export interface VTBuffer {
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
  fetchBuffers!: Table<FetchFeatureBuffer>;
  transformBuffers!: Table<TransformFeatureBuffer>;
  vtBuffers!: Table<VTBuffer>;
  sessions!: Table<BatchSessionMetadata<Config>>;

  constructor(name: string) {
    super(name);
    this.version(2)
      .stores({
        fetchBuffers: '&id, nodeId, timestamp',
        transformBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
        vtBuffers: '&id, nodeId, [z+x+y], hash, timestamp',
        sessions: '&nodeId, status, stage, startTime'
      })
      .upgrade(async () => {
        await this.fetchBuffers.clear();
        await this.transformBuffers.clear();
        await this.vtBuffers.clear();
        await this.sessions.clear();
      });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.fetchBuffers,
      this.transformBuffers,
      this.vtBuffers,
      this.sessions
    ], async () => {
      await this.fetchBuffers.where('nodeId').equals(nodeId).delete();
      await this.transformBuffers.where('nodeId').equals(nodeId).delete();
      await this.vtBuffers.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: NodeId, stage: EphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'fetch':
        return (await this.fetchBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform':
        return (
          (await this.transformBuffers.where({ nodeId, stage }).count()) > 0
        );
      case 'vt':
        return (await this.vtBuffers.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: EphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchBuffers,
      this.transformBuffers,
      this.vtBuffers,
      this.sessions,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformBuffers.where({ nodeId, stage }).delete();
          break;
        case 'vt':
          await this.vtBuffers.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }

      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async getNumBuffers(): Promise<{
    numFetchBuffers: number;
    numTransformBuffers: number;
    numVTBuffers: number;
    numSessions: number;
    totalSize: number
  }> {
    const [numFetchBuffers, numTransformBuffers, numVTBuffers, numSessions] = await Promise.all([
      this.fetchBuffers.count(),
      this.transformBuffers.count(),
      this.vtBuffers.count(),
      this.sessions.count()
    ]);

    let totalSize = 0;

    const rawBuffers = await this.fetchBuffers.toArray();
    totalSize += rawBuffers.reduce((sum, buffer) => sum + (buffer.size || 0), 0);

    const tiles = await this.vtBuffers.toArray();
    totalSize += tiles.reduce((sum, tile) => sum + tile.size, 0);

    return {
      numFetchBuffers,
      numTransformBuffers,
      numVTBuffers,
      numSessions,
      totalSize,
    };
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.fetchBuffers,
      this.transformBuffers,
      this.vtBuffers,
      this.sessions,
    ], async () => {
      await Promise.all([
        this.fetchBuffers.clear(),
        this.transformBuffers.clear(),
        this.vtBuffers.clear(),
        this.sessions.clear()
      ]);
    });
  }
}
