import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchTaskRecord,
  ShapeBatchSessionRecord,
  ShapeExtractSourceBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeVectorTileRecord,
} from '@hierarchidb/plugin-service-api';
import { storeDownloadBufferForNode } from './shapeChunkStore.js';
import { getEphemeralShapeDB } from '@hierarchidb/shape-store';
import type {
  BatchProcessConfig,
  BatchSessionRecord,
  LayerInfo,
  ProcessingStage,
  ProgressInfo,
  ResourceUsage,
  ShapeDB,
  StageStatus,
  VectorTileRecord,
} from '@hierarchidb/shape-store';
import type { ShapeBatchProgressSummary } from '@hierarchidb/plugin-service-api';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isTaskStatus = (value: unknown): value is StageStatus['status'] =>
  value === 'waiting'
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

const isBatchProcessConfig = (value: unknown): value is BatchProcessConfig => {
  if (!isRecord(value)) return false;
  return isRecord(value.download)
    && isRecord(value.extract1)
    && isRecord(value.extract2)
    && isRecord(value.vectorTiles);
};

const toProgressInfo = (progress: ShapeBatchProgressSummary): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  currentStage: toProcessingStage(progress.currentStage),
  currentTask: progress.currentTask,
});

const toProcessingStage = (
  stage: ShapeBatchProgressSummary['currentStage'],
): ProgressInfo['currentStage'] => {
  if (stage === 'processing') return stage;
  if (
    stage === 'download'
    || stage === 'extract1'
    || stage === 'extract2'
    || stage === 'vectortile'
    || stage === 'fetch'
    || stage === 'transform'
    || stage === 'vt'
  ) {
    return stage;
  }
  return undefined;
};

const toStageMap = (stages: Record<string, unknown>): Record<ProcessingStage, StageStatus> => {
  const empty: StageStatus = {
    status: 'waiting',
    progress: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  const read = (stage: ProcessingStage): StageStatus => {
    const candidate = stages[stage];
    return isStageStatus(candidate) ? candidate : empty;
  };
  return {
    download: read('download'),
    extract1: read('extract1'),
    extract2: read('extract2'),
    vectortile: read('vectortile'),
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

const toBatchSessionRecord = (session: ShapeBatchSessionRecord): BatchSessionRecord => {
  if (!isBatchProcessConfig(session.config)) {
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

const toBatchSessionUpdates = (updates: Partial<ShapeBatchSessionRecord>): Partial<BatchSessionRecord> => {
  const next: Partial<BatchSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.config !== undefined) {
    if (!isBatchProcessConfig(updates.config)) {
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

  async upsertBatchSession(session: ShapeBatchSessionRecord): Promise<void> {
    await this.ensureOpen();
    await this.db.batchSessions.put(toBatchSessionRecord(session));
  }

  async updateBatchSession(nodeId: NodeId, updates: Partial<ShapeBatchSessionRecord>): Promise<void> {
    await this.ensureOpen();
    await this.db.updateBatchSession(nodeId, toBatchSessionUpdates(updates));
  }

  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.batchSessions.delete(nodeId);
  }

  async deleteBatchTasks(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.batchTasks.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.delete(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.vectorTiles.where('nodeId').equals(nodeId).delete?.();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.features.where('nodeId').equals(nodeId).delete?.();
  }

  async clearCache(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    const keys = await ephemeral.cache
      .filter((entry) => entry.key.includes(String(nodeId)))
      .primaryKeys();
    if (keys.length > 0) {
      await ephemeral.cache.bulkDelete(keys);
    }
    return keys.length;
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.deleteBatchSession(nodeId);
    await this.deleteFeatures(nodeId);
    await this.deleteFeatureBuffers(nodeId);
    await this.deleteTileBuffers(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearCache(nodeId);
    await this.clearTileIndexArtifacts(String(nodeId));
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.batchTasks.where('nodeId').equals(nodeId).delete();
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.clearNodeData(nodeId);
  }

  async upsertBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void> {
    await this.ensureOpen();
    if (tasks.length === 0) return;
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.batchTasks.bulkPut?.(tasks);
  }

  async updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void> {
    await this.ensureOpen();
    const ephemeral = getEphemeralShapeDB();
    await ephemeral.batchTasks.update?.(taskId, {
      ...updates,
      updatedAt: updates.updatedAt ?? Date.now(),
    });
  }

  async putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeDownloadBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }

  async putExtractedBuffers(buffers: ShapeExtractSourceBufferRecord[]): Promise<void> {
    const db = getEphemeralShapeDB();
    if (buffers.length === 0) return;
    const extract1Buffers = buffers.filter((buffer) => buffer.stage === 'extract1');
    const extract2Buffers = buffers.filter((buffer) => buffer.stage === 'extract2');
    if (extract1Buffers.length > 0) {
      await db.extractedBuffers.bulkPut(extract1Buffers);
    }
    if (extract2Buffers.length > 0) {
      await db.extract2SourceBuffers.bulkPut(extract2Buffers);
    }
  }

  async putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void> {
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

  async putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
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
