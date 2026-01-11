import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { BatchProcessConfig, BatchTaskRecord, TaskStatus } from './ShapeDB.js';
import type { FeatureBufferRecord, TileBufferRecord } from './ShapeDB.js';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBatchSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
} from '@hierarchidb/gis-sdk';

export type BatchSessionMetadata = BaseBatchSessionMetadata<BatchProcessConfig>;

export type TransformSourceBuffer = {
  id: string;
  nodeId: NodeId;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
};

export type VTSourceBuffer = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  data: ArrayBuffer;
  size: number;
  featureCount?: number;
  timestamp: number;
  contentType?: string;
};

export type GeojsonVtIndexRecord = {
  id: string;
  nodeId: NodeId;
  bufferId: string;
  index: Record<string, unknown>;
  options: {
    extent: number;
    buffer: number;
    indexMaxZoom: number;
    promoteId: string;
  };
  createdAt: number;
};

export type TileIdToBufferRelation = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  bufferId: string;
  createdAt: number;
};

export class EphemeralShapeDB extends EphemeralGisDB<BatchProcessConfig> {
  batchTasks!: Table<BatchTaskRecord, string>;
  featureBuffers!: Table<FeatureBufferRecord, string>;
  tileBuffers!: Table<TileBufferRecord, string>;
  tileIdToBufferRelations!: Table<TileIdToBufferRelation, string>;
  transformSourceBuffers!: Table<TransformSourceBuffer, string>;
  vectorTileSourceBuffers!: Table<VTSourceBuffer, string>;
  geojsonVtIndexes!: Table<GeojsonVtIndexRecord, string>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(8).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType]',
      extract2SourceBuffers: '&id, nodeId, countryCode, adminLevel, [nodeId+countryCode+adminLevel], timestamp',
      vectorTileSourceBuffers: '&id, nodeId, tileId, [nodeId+tileId], timestamp',
      geojsonVtIndexes: '&id, nodeId, bufferId, [nodeId+bufferId], createdAt',
    }).upgrade((tx) =>
      tx.table('batchTasks')
        .toCollection()
        .modify((task) => {
          if (task.status === 'waiting') {
            task.status = 'queued';
          }
        })
    );
    this.featureBuffers = this.table('featureBuffers');
    this.tileBuffers = this.table('tileBuffers');
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');
    this.batchTasks = this.table('batchTasks');
    this.transformSourceBuffers = this.table('extract2SourceBuffers');
    this.vectorTileSourceBuffers = this.table('vectorTileSourceBuffers');
    this.geojsonVtIndexes = this.table('geojsonVtIndexes');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await super.clearNodeData(nodeId);
    await this.featureBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
    await this.batchTasks.where('nodeId').equals(nodeId).delete();
    await this.transformSourceBuffers.where('nodeId').equals(nodeId).delete();
    await this.vectorTileSourceBuffers.where('nodeId').equals(nodeId).delete();
    await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
  }

  async hasStageData(nodeId: NodeId, stage: BaseEphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'fetch':
        return (await this.fetchBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform':
        return (await this.transformBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'vt':
        return (await this.vtBuffers.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: BaseEphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchBuffers,
      this.transformBuffers,
      this.transformSourceBuffers,
      this.vectorTileSourceBuffers,
      this.sessions,
      this.featureBuffers,
      this.tileBuffers,
      this.tileIdToBufferRelations,
      this.batchTasks,
      this.geojsonVtIndexes,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'vt':
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
          await this.vectorTileSourceBuffers.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.sessions.where('nodeId').equals(nodeId).delete();
      await this.featureBuffers.where('[nodeId+stage]').equals([nodeId, stage]).delete();
      await this.tileBuffers.where('nodeId').equals(nodeId).and((entry) => entry.stage === stage).delete();
    });
  }

  /*
  async getStatistics(): Promise<{
    rawBuffers: number;
    extractedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }> {
    const base = await super.getStatistics();
    const [extract2Count, vectorTileSourceCount] = await Promise.all([
      this.extract2SourceBuffers.count(),
      this.vectorTileSourceBuffers.count(),
    ]);
    return {
      ...base,
      extractedBuffers: base.extractedBuffers + extract2Count,
      vectorTiles: vectorTileSourceCount,
    };
  }
   */

  async clearAll(): Promise<void> {
    await super.clearAll();
    await this.featureBuffers.clear();
    await this.tileBuffers.clear();
    await this.tileIdToBufferRelations.clear();
    await this.batchTasks.clear();
    await this.transformSourceBuffers.clear();
    await this.vectorTileSourceBuffers.clear();
    await this.geojsonVtIndexes.clear();
  }

  async createBatchTask(
    task: Omit<BatchTaskRecord, 'taskId'> & { taskId?: string },
  ): Promise<BatchTaskRecord> {
    const taskId = task.taskId ?? crypto.randomUUID();
    const fullTask: BatchTaskRecord = {
      ...task,
      taskId,
    };

    await this.batchTasks.put(fullTask);
    return fullTask;
  }

  async updateBatchTask(taskId: string, updates: Partial<BatchTaskRecord>): Promise<void> {
    await this.batchTasks.update(taskId, updates);
  }

  async getBatchTasks(nodeId: NodeId): Promise<BatchTaskRecord[]> {
    return await this.batchTasks.where('nodeId').equals(nodeId).sortBy('index');
  }

  async getTasksByStatus(nodeId: NodeId, status: TaskStatus): Promise<BatchTaskRecord[]> {
    return await this.batchTasks.where('[nodeId+status]').equals([nodeId, status]).toArray();
  }
}

export const ephemeralShapeDB = new EphemeralShapeDB();
