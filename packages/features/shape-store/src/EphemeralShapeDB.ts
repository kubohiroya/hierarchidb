import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import type { Table } from 'dexie';
import type { BuildProcessConfig, BuildSessionRecord, BuildTaskRecord, TaskStatus } from './ShapeDB.js';
import type { ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBuildSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
} from '@hierarchidb/gis-sdk';

export type BuildSessionMetadata = BaseBuildSessionMetadata<BuildProcessConfig>;

type DomainType = 'shape' | 'route';

export type TransformCacheRecord = {
  id: string;
  nodeId: NodeId;
  bandId: number;
  domainType: DomainType;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  extractionRatio: number;
  tolerance: number;
  timestamp: number;
};

export type FetchCacheRecord = {
  id: string;
  nodeId: NodeId;
  domainType: DomainType;
  sourceKey: string;
  countryCode?: string;
  adminLevel?: number;
  data: ArrayBuffer;
  format?: 'flatgeobuf' | 'topojson';
  compression?: 'gzip' | 'none';
  featureCount: number;
  inputFeatureCount?: number;
  bbox: [number, number, number, number];
  downloadTime: number;
  size: number;
  vertexCount?: number;
  polygonCount?: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  timestamp: number;
};

export type TileIdToBufferRelation = {
  id: string;
  nodeId: NodeId;
  bandId: number;
  tileId: string;
  bufferId: string;
  createdAt: number;
};

export class EphemeralShapeDB extends EphemeralGisDB<BuildProcessConfig, BuildSessionRecord> {
  buildTasks!: Table<BuildTaskRecord, string>;
  tileIdToBufferRelations!: Table<TileIdToBufferRelation, string>;
  declare fetchCache: Table<FetchCacheRecord, string>;
  declare transformCache: Table<TransformCacheRecord, string>;
  transformErrors!: Table<ShapeTransformErrorRecord, string>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(16).stores({
      fetchCache: '&id, nodeId, [nodeId+sourceKey]',
      transformCache: '&id, nodeId',
      sessions: '&nodeId',
      tileIdToBufferRelations: '&id, nodeId, bufferId',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType]',
      transformErrors: '&id, nodeId',
    }).upgrade((tx) =>
      tx.table('batchTasks')
        .toCollection()
        .modify((task) => {
          if (task.status === 'waiting') {
            task.status = 'queued';
          }
        })
    );
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');
    this.buildTasks = this.table('batchTasks');
    this.fetchCache = this.table('fetchCache');
    this.transformCache = this.table('transformCache');
    this.transformErrors = this.table('transformErrors');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await super.clearNodeData(nodeId);
    await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
    await this.buildTasks.where('nodeId').equals(nodeId).delete();
    await this.transformErrors.where('nodeId').equals(nodeId).delete();
  }

  async hasStageData(nodeId: NodeId, stage: BaseEphemeralStage): Promise<boolean> {
    return this.transaction('r', [this.fetchCache, this.transformCache, this.tileIdToBufferRelations], async () => {
      switch (stage) {
        case 'fetch':
          return (await this.fetchCache.where('nodeId').equals(nodeId).count()) > 0;
        case 'transform':
          return (await this.transformCache
            .where('nodeId')
            .equals(nodeId)
            .filter((record) => record.timestamp > 0)
            .count()) > 0;
        case 'vt':
          return (await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
        default:
          return false;
      }
    });
  }

  async clearStage(nodeId: NodeId, stage: BaseEphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.transformErrors,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformCache.where('nodeId').equals(nodeId).delete();
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.transformErrors.where('nodeId').equals(nodeId).delete();
          break;
        case 'vt':
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async clearAll(): Promise<void> {
    await super.clearAll();
    await this.tileIdToBufferRelations.clear();
    await this.buildTasks.clear();
    await this.transformErrors.clear();
  }

  async createBuildTask(
    task: Omit<BuildTaskRecord, 'taskId'> & { taskId?: string },
  ): Promise<BuildTaskRecord> {
    const taskId = task.taskId ?? crypto.randomUUID();
    const fullTask: BuildTaskRecord = {
      ...task,
      taskId,
    };

    await this.buildTasks.put(fullTask);
    return fullTask;
  }

  async updateBuildTask(taskId: string, updates: Partial<BuildTaskRecord>): Promise<void> {
    await this.buildTasks.update(taskId, updates);
  }

  async getBuildTasks(nodeId: NodeId): Promise<BuildTaskRecord[]> {
    return await this.buildTasks.where('nodeId').equals(nodeId).sortBy('index');
  }

  async getTasksByStatus(nodeId: NodeId, status: TaskStatus): Promise<BuildTaskRecord[]> {
    return await this.buildTasks.where('[nodeId+status]').equals([nodeId, status]).toArray();
  }
}

export const ephemeralShapeDB = new EphemeralShapeDB();
