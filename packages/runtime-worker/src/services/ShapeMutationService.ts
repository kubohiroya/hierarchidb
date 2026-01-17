import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildSessionRecord,
  ShapeTransformCache,
  ShapeFeatureMetadata,
  ShapeMutationAPI,
  ShapeFetchCache,
  ShapeSourceMetadata,
  ShapeVectorTileRecord,
} from '@hierarchidb/plugin-service-api';
import { storeRawDataDataSourceBufferForNode } from './shapeChunkStore.js';
import {
  ephemeralShapeDB,
  type BuildProcessConfig,
  type BuildSessionRecord,
  type LayerInfo,
  type BuildStage,
  type ProgressInfo,
  type ResourceUsage,
  type ShapeDB,
  type StageStatus,
  type VectorTileRecord,
} from '@hierarchidb/shape-store';
import type { ShapeBuildProgressSummary } from '@hierarchidb/plugin-service-api';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isTaskStatus = (value: unknown): value is StageStatus['status'] =>
  value === 'queued'
  || value === 'running'
  || value === 'completed'
  || value === 'failed'
  || value === 'regression';

const isStageStatus = (value: unknown): value is StageStatus => {
  if (!isRecord(value)) return false;
  return isTaskStatus(value.status)
    && isNumber(value.progress)
    && isNumber(value.tasksTotal)
    && isNumber(value.tasksCompleted)
    && isNumber(value.tasksFailed)
    && (value.message === undefined || typeof value.message === 'string');
};

const isBuildProcessConfig = (value: unknown): value is BuildProcessConfig => {
  if (!isRecord(value)) return false;
  return isRecord(value.download)
    && isRecord(value.extract1)
    && isRecord(value.extract2)
    && isRecord(value.vectorTiles);
};

const toProgressInfo = (progress: ShapeBuildProgressSummary): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  taskType: toBuildStage(progress.taskType),
});

const toBuildStage = (
  stage: ShapeBuildProgressSummary['taskType'],
): ProgressInfo['taskType'] => {
  if (stage === 'processing') return stage;
  if (
    stage === 'fetch'
    || stage === 'transform'
    || stage === 'vt'
  ) {
    return stage;
  }
  return undefined;
};

const toStageMap = (stages: Record<string, unknown>): Record<BuildStage, StageStatus> => {
  const empty: StageStatus = {
    status: 'queued',
    progress: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  const read = (stage: BuildStage): StageStatus => {
    const candidate = stages[stage];
    return isStageStatus(candidate) ? candidate : empty;
  };
  return {
    fetch: read('fetch'),
    transform: read('transform'),
    vt: read('vt'),
  };
};

const toResourceUsage = (usage: Record<string, unknown> | undefined): ResourceUsage | undefined => {
  if (!usage) return undefined;
  if (!isNumber(usage.memoryUsed)
    || !isNumber(usage.memoryPeak)
    || !isNumber(usage.cpuPercent)
    || !isNumber(usage.storageUsed)
    || !isNumber(usage.networkBytesReceived)
    || !isNumber(usage.networkBytesSent)) {
    return undefined;
  }
  return {
    memoryUsed: usage.memoryUsed,
    memoryPeak: usage.memoryPeak,
    cpuPercent: usage.cpuPercent,
    storageUsed: usage.storageUsed,
    networkBytesReceived: usage.networkBytesReceived,
    networkBytesSent: usage.networkBytesSent,
  };
};

const toBuildSessionRecord = (session: ShapeBuildSessionRecord): BuildSessionRecord => {
  if (!isBuildProcessConfig(session.config)) {
    throw new Error('Invalid shape batch session config');
  }
  return {
    nodeId: session.nodeId,
    draftId: session.draftId,
    status: session.status,
    config: session.config,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressInfo(session.progress),
    stages: toStageMap(session.stages),
    resourceUsage: toResourceUsage(session.resourceUsage),
    canResume: session.canResume,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
  };
};

const toBuildSessionUpdates = (updates: Partial<ShapeBuildSessionRecord>): Partial<BuildSessionRecord> => {
  const next: Partial<BuildSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.config !== undefined) {
    if (!isBuildProcessConfig(updates.config)) {
      throw new Error('Invalid shape batch session config');
    }
    next.config = updates.config;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressInfo(updates.progress);
  if (updates.stages !== undefined) next.stages = toStageMap(updates.stages);
  if (updates.resourceUsage !== undefined) next.resourceUsage = toResourceUsage(updates.resourceUsage);
  if (updates.canResume !== undefined) next.canResume = updates.canResume;
  if (updates.lastActivity !== undefined) next.lastActivity = updates.lastActivity;
  if (updates.expiresAt !== undefined) next.expiresAt = updates.expiresAt;
  return next;
};

const toVectorTileRecord = (tile: ShapeVectorTileRecord): VectorTileRecord => {
  const layers: LayerInfo[] = (tile.layers ?? []).map((layer) => ({
    name: layer.name,
    featureCount: layer.featureCount ?? 0,
    minZoom: tile.z,
    maxZoom: tile.z,
    fields: [],
  }));

  return {
    tileId: tile.tileId,
    nodeId: tile.nodeId,
    z: tile.z,
    x: tile.x,
    y: tile.y,
    data_Uint8Array: tile.data_Uint8Array,
    size: tile.size,
    features: tile.features,
    layers,
    generatedAt: tile.generatedAt,
    lastAccessed: tile.lastAccessed,
    contentHash: tile.contentHash ?? '',
    contentEncoding: tile.contentEncoding as VectorTileRecord['contentEncoding'],
    version: tile.version ?? 1,
  };
};

export class ShapeMutationService implements ShapeMutationAPI {
  static async getSingleton(db: ShapeDB): Promise<ShapeMutationService> {
    return SingletonMixin.getSingleton('ShapeMutationService', async () => new ShapeMutationService(db));
  }

  constructor(private db: ShapeDB) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void> {
    await this.ensureOpen();
    await this.db.buildSessions.put(toBuildSessionRecord(session));
  }

  async updateBuildSession(nodeId: NodeId, updates: Partial<ShapeBuildSessionRecord>): Promise<void> {
    await this.ensureOpen();
    await this.db.updateBuildSession(nodeId, toBuildSessionUpdates(updates));
  }

  async deleteBuildSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.buildSessions.delete(nodeId);
  }

  async deleteBuildTasks(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.delete(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.where('nodeId').equals(nodeId).delete?.();
  }


  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.features.where('nodeId').equals(nodeId).delete?.();
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.deleteBuildSession(nodeId);
    await this.deleteFeatures(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearTileIndexArtifacts(String(nodeId));
    await ephemeralShapeDB.buildTasks.where('nodeId').equals(nodeId).delete();
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    await ephemeralShapeDB.clearNodeData(nodeId);
  }

  async upsertBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void> {
    await this.ensureOpen();
    if (tasks.length === 0) return;
    await ephemeralShapeDB.buildTasks.bulkPut?.(tasks);
  }

  async updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void> {
    await this.ensureOpen();
    await ephemeralShapeDB.buildTasks.update?.(taskId, updates);
  }

  async putFetchCaches(buffers: ShapeFetchCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }

  async putTransformCaches(buffers: ShapeTransformCache[]): Promise<void> {
    if (buffers.length === 0) return;
    await ephemeralShapeDB.transformCache.bulkPut(buffers);
  }

  async putSourceMetadata(rows: ShapeSourceMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.sourceMetadata.bulkPut?.(rows);
  }

  async deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.sourceMetadata.bulkDelete?.(ids);
  }

  async deleteSourceMetadataByNode(nodeId: string): Promise<void> {
    await this.db.sourceMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadata[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.featureMetadata.bulkPut?.(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: string): Promise<void> {
    await this.db.featureMetadata.where('nodeId').equals(nodeId).delete?.();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

  async storeVectorTile(tile: ShapeVectorTileRecord): Promise<void> {
    await this.ensureOpen();
    await this.db.storeVectorTile(toVectorTileRecord(tile));
  }

  private async clearTileIndexArtifacts(nodeId: string): Promise<void> {
    void nodeId;
  }
}
