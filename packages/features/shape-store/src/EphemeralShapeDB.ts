import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { BatchProcessConfig, BatchTaskRecord, TaskStatus } from './ShapeDB.js';
import type { FeatureBufferRecord, TileBufferRecord } from './ShapeDB.js';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBatchSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
  type ProcessingCache as BaseProcessingCache,
  type RawFeatureBuffer as BaseRawFeatureBuffer,
  type ExtractedFeatureBuffer as BaseExtract1SourceBuffer,
  type VectorTileData as BaseVectorTileData,
} from '@hierarchidb/gis-sdk';

export type RawFeatureBuffer = BaseRawFeatureBuffer;
export type Extract1SourceBuffer = Omit<BaseExtract1SourceBuffer, 'stage'> & { stage: 'extract1' };
export type VectorTileData = BaseVectorTileData;
export type EphemeralStage = BaseEphemeralStage;
export type ProcessingCache = BaseProcessingCache;
export type BatchSessionMetadata = BaseBatchSessionMetadata<BatchProcessConfig>;
export type TileIdToBufferRelation = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  bufferId: string;
  createdAt: number;
};

export type Extract2SourceBuffer = {
  id: string;
  nodeId: NodeId;
  stage: 'extract2';
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
};

export type VectorTileSourceBuffer = {
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

export class EphemeralShapeDB extends EphemeralGisDB<BatchProcessConfig> {
  featureBuffers!: Table<FeatureBufferRecord, string>;
  tileBuffers!: Table<TileBufferRecord, string>;
  tileIdToBufferRelations!: Table<TileIdToBufferRelation, string>;
  batchTasks!: Table<BatchTaskRecord, string>;
  extract2SourceBuffers!: Table<Extract2SourceBuffer, string>;
  vectorTileSourceBuffers!: Table<VectorTileSourceBuffer, string>;
  geojsonVtIndexes!: Table<GeojsonVtIndexRecord, string>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(3).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
    });
    this.version(4).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
    });
    this.version(5).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType], [nodeId+index], status, taskType, startedAt',
    });
    this.version(6).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType], [nodeId+index], status, taskType, startedAt',
      extract2SourceBuffers: '&id, nodeId, countryCode, adminLevel, [nodeId+countryCode+adminLevel], timestamp',
      vectorTileSourceBuffers: '&id, nodeId, tileId, [nodeId+tileId], timestamp',
    });
    this.version(7).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType], [nodeId+index], status, taskType, startedAt',
      extract2SourceBuffers: '&id, nodeId, countryCode, adminLevel, [nodeId+countryCode+adminLevel], timestamp',
      vectorTileSourceBuffers: '&id, nodeId, tileId, [nodeId+tileId], timestamp',
      geojsonVtIndexes: '&id, nodeId, bufferId, [nodeId+bufferId], createdAt',
    });
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
    this.extract2SourceBuffers = this.table('extract2SourceBuffers');
    this.vectorTileSourceBuffers = this.table('vectorTileSourceBuffers');
    this.geojsonVtIndexes = this.table('geojsonVtIndexes');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await super.clearNodeData(nodeId);
    await this.featureBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
    await this.batchTasks.where('nodeId').equals(nodeId).delete();
    await this.extract2SourceBuffers.where('nodeId').equals(nodeId).delete();
    await this.vectorTileSourceBuffers.where('nodeId').equals(nodeId).delete();
    await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
  }

  async hasStageData(nodeId: NodeId, stage: BaseEphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'download':
        return (await this.rawBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'extract1':
        return (await this.extractedBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'extract2':
        return (await this.extract2SourceBuffers.where('nodeId').equals(nodeId).count()) > 0;
      case 'vectorTiles':
        return (await this.vectorTileSourceBuffers.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: BaseEphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.rawBuffers,
      this.extractedBuffers,
      this.extract2SourceBuffers,
      this.vectorTileSourceBuffers,
      this.sessions,
      this.cache,
      this.featureBuffers,
      this.tileBuffers,
      this.tileIdToBufferRelations,
      this.batchTasks,
      this.geojsonVtIndexes,
    ], async () => {
      switch (stage) {
        case 'download':
          await this.rawBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'extract1':
          await this.extractedBuffers.where('nodeId').equals(nodeId).delete();
          break;
        case 'extract2':
          await this.extract2SourceBuffers.where('nodeId').equals(nodeId).delete();
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
          break;
        case 'vectorTiles':
          await this.vectorTileSourceBuffers.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.sessions.where('nodeId').equals(nodeId).delete();
      const cacheKeys = await this.cache
        .filter(entry => entry.key.includes(String(nodeId)))
        .primaryKeys();
      await this.cache.bulkDelete(cacheKeys);

      await this.featureBuffers.where('[nodeId+stage]').equals([nodeId, stage]).delete();
      await this.tileBuffers.where('nodeId').equals(nodeId).and((entry) => entry.stage === stage).delete();
    });
  }

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

  async clearAll(): Promise<void> {
    await super.clearAll();
    await this.featureBuffers.clear();
    await this.tileBuffers.clear();
    await this.tileIdToBufferRelations.clear();
    await this.batchTasks.clear();
    await this.extract2SourceBuffers.clear();
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

let ephemeralDBInstance: EphemeralShapeDB | null = null;

export function getEphemeralShapeDB(): EphemeralShapeDB {
  if (!ephemeralDBInstance) {
    ephemeralDBInstance = new EphemeralShapeDB();
  }
  return ephemeralDBInstance;
}

export async function closeEphemeralShapeDB(): Promise<void> {
  if (ephemeralDBInstance) {
    await ephemeralDBInstance.close();
    ephemeralDBInstance = null;
  }
}
