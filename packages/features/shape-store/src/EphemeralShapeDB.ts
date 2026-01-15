import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { BuildProcessConfig, BuildTaskRecord, TaskStatus } from './ShapeDB.js';
import type { FeatureBufferRecord, TileBufferRecord } from './ShapeDB.js';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBuildSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
} from '@hierarchidb/gis-sdk';

export type BuildSessionMetadata = BaseBuildSessionMetadata<BuildProcessConfig>;

type DomainType = 'shape' | 'route';

export type TransformByBandCacheRecord = {
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

export type TransformByZoomCacheRecord = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  data: ArrayBuffer;
  size: number;
  featureCount: number;
  extractionRatio: number;
  timestamp: number;
  contentType?: string;
};

export type TransformByZoomReservation = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  createdAt: number;
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

export class EphemeralShapeDB extends EphemeralGisDB<BuildProcessConfig> {
  buildTasks!: Table<BuildTaskRecord, string>;
  featureBuffers!: Table<FeatureBufferRecord, string>;
  tileBuffers!: Table<TileBufferRecord, string>;
  tileIdToBufferRelations!: Table<TileIdToBufferRelation, string>;
  declare transformByBandCache: Table<TransformByBandCacheRecord, string>;
  declare transformByZoomCache: Table<TransformByZoomCacheRecord, string>;
  transformByZoomReservations!: Table<TransformByZoomReservation, string>;
  geojsonVtIndexes!: Table<GeojsonVtIndexRecord, string>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(11).stores({
      fetchCache: '&id, nodeId, timestamp',
      transformByBandCache: '&id, nodeId, bandId, domainType, sourceKey, [nodeId+bandId], [nodeId+bandId+sourceKey], countryCode, adminLevel, [nodeId+countryCode+adminLevel], timestamp',
      transformByZoomCache: '&id, nodeId, tileId, [nodeId+tileId], timestamp',
      transformByZoomReservations: '&id, nodeId, tileId, [nodeId+tileId], createdAt',
      vtCache: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
      batchTasks: '&taskId, nodeId, [nodeId+status], [nodeId+taskType]',
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
    this.buildTasks = this.table('batchTasks');
    this.transformByBandCache = this.table('transformByBandCache');
    this.transformByZoomCache = this.table('transformByZoomCache');
    this.transformByZoomReservations = this.table('transformByZoomReservations');
    this.geojsonVtIndexes = this.table('geojsonVtIndexes');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await super.clearNodeData(nodeId);
    await this.featureBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
    await this.buildTasks.where('nodeId').equals(nodeId).delete();
    await this.transformByBandCache.where('nodeId').equals(nodeId).delete();
    await this.transformByZoomCache.where('nodeId').equals(nodeId).delete();
    await this.transformByZoomReservations.where('nodeId').equals(nodeId).delete();
    await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
  }

  async hasStageData(nodeId: NodeId, stage: BaseEphemeralStage): Promise<boolean> {
    switch (stage) {
      case 'fetch':
        return (await this.fetchCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform-by-band':
        return (await this.transformByBandCache.where('nodeId').equals(nodeId).count()) > 0;
      case 'transform-by-zoom':
        return (await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
      case 'vt':
        return (await this.vtCache.where('nodeId').equals(nodeId).count()) > 0;
      default:
        return false;
    }
  }

  async clearStage(nodeId: NodeId, stage: BaseEphemeralStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformByBandCache,
      this.transformByZoomCache,
      this.transformByZoomReservations,
      this.vtCache,
      this.sessions,
      this.featureBuffers,
      this.tileBuffers,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.geojsonVtIndexes,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform-by-band':
          await this.transformByBandCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform-by-zoom':
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
          await this.transformByZoomCache.where('nodeId').equals(nodeId).delete();
          await this.transformByZoomReservations.where('nodeId').equals(nodeId).delete();
          break;
        case 'vt':
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.geojsonVtIndexes.where('nodeId').equals(nodeId).delete();
          await this.transformByZoomCache.where('nodeId').equals(nodeId).delete();
          await this.transformByZoomReservations.where('nodeId').equals(nodeId).delete();
          await this.vtCache.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.sessions.where('nodeId').equals(nodeId).delete();
      await this.featureBuffers.where('[nodeId+stage]').equals([nodeId, stage]).delete();
      await this.tileBuffers.where('nodeId').equals(nodeId).and((entry) => entry.stage === stage).delete();
    });
  }

  async clearAll(): Promise<void> {
    await super.clearAll();
    await this.featureBuffers.clear();
    await this.tileBuffers.clear();
    await this.tileIdToBufferRelations.clear();
    await this.buildTasks.clear();
    await this.transformByBandCache.clear();
    await this.transformByZoomCache.clear();
    await this.transformByZoomReservations.clear();
    await this.geojsonVtIndexes.clear();
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
