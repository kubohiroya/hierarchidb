import type {
  ShapeBatchProgressSummary,
  ShapeBatchSessionRecord,
  ShapeVectorTileRecord,
} from '@hierarchidb/plugin-service-api';
import type {
  BatchProcessConfig,
  BatchSessionRecord,
  LayerInfo,
  ProcessingStage,
  ProgressInfo,
  ResourceUsage,
  StageStatus,
  VectorTileRecord,
} from '../database/ShapeDB.js';

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

export const isBatchProcessConfig = (value: unknown): value is BatchProcessConfig => {
  if (!isRecord(value)) return false;
  return isRecord(value.download)
    && isRecord(value.extract1)
    && isRecord(value.extract2)
    && isRecord(value.vectorTiles);
};

export const toProcessingStage = (
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

export const toProgressInfo = (progress: ShapeBatchProgressSummary): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  currentStage: toProcessingStage(progress.currentStage),
  currentTask: progress.currentTask,
});

export const toProgressSummary = (progress: ProgressInfo): ShapeBatchProgressSummary => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  currentStage: progress.currentStage,
  currentTask: progress.currentTask,
});

const toStageMap = (stages: Record<string, unknown> | undefined): Record<ProcessingStage, StageStatus> => {
  const empty: StageStatus = {
    status: 'waiting',
    progress: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  const read = (stage: ProcessingStage): StageStatus => {
    const candidate = stages?.[stage];
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

const toResourceUsageRecord = (usage: ResourceUsage | undefined): Record<string, unknown> | undefined =>
  usage ? { ...usage } : undefined;

export const toBatchSessionRecord = (session: ShapeBatchSessionRecord): BatchSessionRecord | null => {
  if (!isBatchProcessConfig(session.config)) return null;
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

export const toBatchSessionUpdates = (
  updates: Partial<ShapeBatchSessionRecord>,
): Partial<BatchSessionRecord> | null => {
  const next: Partial<BatchSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.config !== undefined) {
    if (!isBatchProcessConfig(updates.config)) return null;
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

export const toShapeBatchSessionRecord = (session: BatchSessionRecord): ShapeBatchSessionRecord => ({
  nodeId: session.nodeId,
  draftId: session.draftId,
  status: session.status,
  config: session.config,
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
  progress: toProgressSummary(session.progress),
  stages: { ...session.stages },
  resourceUsage: toResourceUsageRecord(session.resourceUsage),
  canResume: session.canResume,
  lastActivity: session.lastActivity,
  expiresAt: session.expiresAt,
});

export const toShapeBatchSessionUpdates = (
  updates: Partial<BatchSessionRecord>,
): Partial<ShapeBatchSessionRecord> => {
  const next: Partial<ShapeBatchSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.config !== undefined) next.config = updates.config;
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressSummary(updates.progress);
  if (updates.stages !== undefined) next.stages = { ...updates.stages };
  if (updates.resourceUsage !== undefined) next.resourceUsage = toResourceUsageRecord(updates.resourceUsage);
  if (updates.canResume !== undefined) next.canResume = updates.canResume;
  if (updates.lastActivity !== undefined) next.lastActivity = updates.lastActivity;
  if (updates.expiresAt !== undefined) next.expiresAt = updates.expiresAt;
  return next;
};

export const toVectorTileRecord = (tile: ShapeVectorTileRecord): VectorTileRecord => {
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
    contentEncoding: tile.contentEncoding === 'gzip' || tile.contentEncoding === 'br'
      ? tile.contentEncoding
      : undefined,
    version: tile.version ?? 1,
  };
};
