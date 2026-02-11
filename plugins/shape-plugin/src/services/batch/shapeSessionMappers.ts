import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeVectorTileRecord,
} from '@hierarchidb/shape-api';
import type {
  BuildSessionConfig,
  BuildSessionRecord,
  BuildTaskType,
  LayerInfo,
  ProgressInfo,
  ResourceUsage,
  StageStatus,
  VectorTileRecord,
} from '@hierarchidb/shape-store';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => isNumber(entry));
};

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

export const isBuildProcessConfig = (value: unknown): value is BuildSessionConfig => {
  if (!isRecord(value)) return false;
  return isRecord(value.fetchConfig)
    && isRecord(value.transformConfig)
    && isRecord(value.vectorTiles);
};

export const toProcessingStage = (
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

export const toProgressInfo = (progress: ShapeBuildProgressSummary): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  taskType: toProcessingStage(progress.taskType),
});

export const toProgressSummary = (progress: ProgressInfo): ShapeBuildProgressSummary => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  taskType: progress.taskType,
});

const toStageMap = (stages: Record<string, unknown> | undefined): Record<BuildTaskType, StageStatus> => {
  const empty: StageStatus = {
    status: 'queued',
    progress: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  const read = (stage: BuildTaskType): StageStatus => {
    const candidate = stages?.[stage];
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

const toResourceUsageRecord = (usage: ResourceUsage | undefined): Record<string, unknown> | undefined =>
  usage ? { ...usage } : undefined;

export const toBuildSessionRecord = (session: ShapeBuildSessionRecord): BuildSessionRecord | null => {
  return {
    nodeId: session.nodeId,
    draftId: session.draftId,
    status: session.status,
    selectedArrayByCountries: session.selectedArrayByCountries,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressInfo(session.progress),
    stages: toStageMap(session.stages),
    resourceUsage: toResourceUsage(session.resourceUsage),
    canResume: session.canResume,
    lastActivity: session.lastActivity,
    expiresAt: session.expiresAt,
    inactiveMs: session.inactiveMs,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stageInactiveMs: session.stageInactiveMs,
    stageStartedAt: session.stageStartedAt,
    stageHeartbeatAt: session.stageHeartbeatAt,
    stageId: session.stageId,
    elapsedMs: session.elapsedMs,
    elapsedByStage: isNumberRecord(session.elapsedByStage) ? session.elapsedByStage : undefined,
  };
};

export const toBuildSessionUpdates = (
  updates: Partial<ShapeBuildSessionRecord>,
): Partial<BuildSessionRecord> | null => {
  const next: Partial<BuildSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.selectedArrayByCountries !== undefined) {
    next.selectedArrayByCountries = updates.selectedArrayByCountries;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressInfo(updates.progress);
  if (updates.stages !== undefined) next.stages = toStageMap(updates.stages);
  if (updates.resourceUsage !== undefined) next.resourceUsage = toResourceUsage(updates.resourceUsage);
  if (updates.stopReason !== undefined) next.stopReason = updates.stopReason;
  if (updates.canResume !== undefined) next.canResume = updates.canResume;
  if (updates.lastActivity !== undefined) next.lastActivity = updates.lastActivity;
  if (updates.expiresAt !== undefined) next.expiresAt = updates.expiresAt;
  if (updates.inactiveMs !== undefined) next.inactiveMs = updates.inactiveMs;
  if (updates.lastHeartbeatAt !== undefined) next.lastHeartbeatAt = updates.lastHeartbeatAt;
  if (updates.stageInactiveMs !== undefined) next.stageInactiveMs = updates.stageInactiveMs;
  if (updates.stageStartedAt !== undefined) next.stageStartedAt = updates.stageStartedAt;
  if (updates.stageHeartbeatAt !== undefined) next.stageHeartbeatAt = updates.stageHeartbeatAt;
  if (updates.stageId !== undefined) next.stageId = updates.stageId;
  if (updates.elapsedMs !== undefined) next.elapsedMs = updates.elapsedMs;
  if (updates.elapsedByStage !== undefined) {
    if (!isNumberRecord(updates.elapsedByStage)) return null;
    next.elapsedByStage = updates.elapsedByStage;
  }
  return next;
};

export const toShapeBuildSessionRecord = (session: BuildSessionRecord): ShapeBuildSessionRecord => ({
  nodeId: session.nodeId,
  draftId: session.draftId,
  status: session.status,
  selectedArrayByCountries: session.selectedArrayByCountries,
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
  progress: toProgressSummary(session.progress),
  stages: { ...session.stages },
  resourceUsage: toResourceUsageRecord(session.resourceUsage),
  stopReason: session.stopReason,
  canResume: session.canResume,
  lastActivity: session.lastActivity,
  expiresAt: session.expiresAt,
  inactiveMs: session.inactiveMs,
  lastHeartbeatAt: session.lastHeartbeatAt,
  stageInactiveMs: session.stageInactiveMs,
  stageStartedAt: session.stageStartedAt,
  stageHeartbeatAt: session.stageHeartbeatAt,
  stageId: session.stageId,
  elapsedMs: session.elapsedMs,
  elapsedByStage: session.elapsedByStage,
});

export const toShapeBuildSessionUpdates = (
  updates: Partial<BuildSessionRecord>,
): Partial<ShapeBuildSessionRecord> => {
  const next: Partial<ShapeBuildSessionRecord> = {};
  if (updates.draftId !== undefined) next.draftId = updates.draftId;
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.selectedArrayByCountries !== undefined) {
    next.selectedArrayByCountries = updates.selectedArrayByCountries;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressSummary(updates.progress);
  if (updates.stages !== undefined) next.stages = { ...updates.stages };
  if (updates.resourceUsage !== undefined) next.resourceUsage = toResourceUsageRecord(updates.resourceUsage);
  if (updates.stopReason !== undefined) next.stopReason = updates.stopReason;
  if (updates.canResume !== undefined) next.canResume = updates.canResume;
  if (updates.lastActivity !== undefined) next.lastActivity = updates.lastActivity;
  if (updates.expiresAt !== undefined) next.expiresAt = updates.expiresAt;
  if (updates.inactiveMs !== undefined) next.inactiveMs = updates.inactiveMs;
  if (updates.lastHeartbeatAt !== undefined) next.lastHeartbeatAt = updates.lastHeartbeatAt;
  if (updates.stageInactiveMs !== undefined) next.stageInactiveMs = updates.stageInactiveMs;
  if (updates.stageStartedAt !== undefined) next.stageStartedAt = updates.stageStartedAt;
  if (updates.stageHeartbeatAt !== undefined) next.stageHeartbeatAt = updates.stageHeartbeatAt;
  if (updates.stageId !== undefined) next.stageId = updates.stageId;
  if (updates.elapsedMs !== undefined) next.elapsedMs = updates.elapsedMs;
  if (updates.elapsedByStage !== undefined) next.elapsedByStage = updates.elapsedByStage;
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
