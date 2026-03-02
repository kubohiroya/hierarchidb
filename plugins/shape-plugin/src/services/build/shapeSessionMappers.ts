import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeVectorTileRecord,
} from '@hierarchidb/shape-api';
import type { EphemeralBuildSessionRecord } from '@hierarchidb/gis-sdk';
import type {
  BuildSessionConfig,
  BuildSessionRecord,
  SourceStageMaxima,
  BuildTaskType,
  LayerInfo,
  ProgressInfo,
  StageStatus,
  VectorTileRecord,
} from '@hierarchidb/shape-store';
import { toLegacyBuildStage } from './stageAlias.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSourceStageMaxima = (value: unknown): value is SourceStageMaxima => {
  if (!isRecord(value)) return false;
  return isNumber(value.featureMax)
    && isNumber(value.polygonMax)
    && value.featureMax >= 0
    && value.polygonMax >= 0;
};

const isTaskStatus = (value: unknown): value is StageStatus['status'] =>
  value === 'queued'
  || value === 'running'
  || value === 'completed'
  || value === 'failed'
  || value === 'recycled';

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
  return isRecord(value.sourceConfig)
    && isRecord(value.geometryConfig)
    && isRecord(value.vectorTiles);
};

export const toProcessingStage = (
  stage: ShapeBuildProgressSummary['stage'],
  stageId?: string,
): BuildTaskType | undefined => {
  return toLegacyBuildStage(stage, stageId);
};

export const toProgressInfo = (
  progress: ShapeBuildProgressSummary,
  stageId?: string,
): ProgressInfo => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  stage: toProcessingStage(progress.stage, stageId),
});

export const toProgressSummary = (
  progress: ProgressInfo,
  stageId?: string,
): ShapeBuildProgressSummary => ({
  total: progress.total,
  completed: progress.completed,
  failed: progress.failed,
  skipped: progress.skipped,
  percentage: progress.percentage,
  stage: (() => {
    return toLegacyBuildStage(progress.stage, stageId);
  })(),
});

export const toEphemeralBuildSessionRecord = (session: ShapeBuildSessionRecord): EphemeralBuildSessionRecord => ({
  nodeId: session.nodeId,
  status: session.status,
  stage: toProcessingStage(session.progress.stage, session.stageId),
  progress: toProgressSummary(session.progress, session.stageId),
  selectedArrayByCountries: session.selectedArrayByCountries,
  stages: toStageMap(session.stages as Record<string, unknown> | undefined),
  stopReason: session.stopReason,
  startedAt: session.startedAt,
  completedAt: session.completedAt,
  lastHeartbeatAt: session.lastHeartbeatAt,
  stageInactiveMs: session.stageInactiveMs,
  stageStartedAt: session.stageStartedAt,
  stageId: session.stageId,
  sourceStageMaxima: isSourceStageMaxima(session.sourceStageMaxima) ? session.sourceStageMaxima : undefined,
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
  const sourceStage = read('source');
  const geometryStage = read('geometry');
  const tileEmitStage = read('tileEmit');
  return {
    source: sourceStage,
    geometry: geometryStage,
    tileEmit: tileEmitStage,
  };
};

export const toBuildSessionRecord = (session: ShapeBuildSessionRecord): BuildSessionRecord | null => {
  return {
    nodeId: session.nodeId,
    status: session.status,
    selectedArrayByCountries: session.selectedArrayByCountries,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    progress: toProgressInfo(session.progress, session.stageId),
    stages: toStageMap(session.stages),
    stopReason: session.stopReason,
    lastHeartbeatAt: session.lastHeartbeatAt,
    stageInactiveMs: session.stageInactiveMs,
    stageStartedAt: session.stageStartedAt,
    stageId: session.stageId,
    sourceStageMaxima: isSourceStageMaxima(session.sourceStageMaxima) ? session.sourceStageMaxima : undefined,
  };
};

export const toBuildSessionUpdates = (
  updates: Partial<ShapeBuildSessionRecord>,
): Partial<BuildSessionRecord> | null => {
  const next: Partial<BuildSessionRecord> = {};
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.selectedArrayByCountries !== undefined) {
    next.selectedArrayByCountries = updates.selectedArrayByCountries;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressInfo(updates.progress, updates.stageId);
  if (updates.stages !== undefined) next.stages = toStageMap(updates.stages);
  if (updates.stopReason !== undefined) next.stopReason = updates.stopReason;
  if (updates.lastHeartbeatAt !== undefined) next.lastHeartbeatAt = updates.lastHeartbeatAt;
  if (updates.stageInactiveMs !== undefined) next.stageInactiveMs = updates.stageInactiveMs;
  if (updates.stageStartedAt !== undefined) next.stageStartedAt = updates.stageStartedAt;
  if (updates.stageId !== undefined) next.stageId = updates.stageId;
  if (updates.sourceStageMaxima !== undefined) {
    if (!isSourceStageMaxima(updates.sourceStageMaxima)) return null;
    next.sourceStageMaxima = updates.sourceStageMaxima;
  }
  return next;
};

export const toEphemeralBuildSessionUpdates = (
  updates: Partial<ShapeBuildSessionRecord>,
): Partial<EphemeralBuildSessionRecord> | null => {
  const next: Partial<EphemeralBuildSessionRecord> = {};
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.selectedArrayByCountries !== undefined) {
    next.selectedArrayByCountries = updates.selectedArrayByCountries;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressSummary(updates.progress, updates.stageId);
  if (updates.stages !== undefined) {
    next.stages = toStageMap(updates.stages as Record<string, unknown> | undefined);
  }
  if (updates.stopReason !== undefined) next.stopReason = updates.stopReason;
  if (updates.lastHeartbeatAt !== undefined) next.lastHeartbeatAt = updates.lastHeartbeatAt;
  if (updates.stageInactiveMs !== undefined) next.stageInactiveMs = updates.stageInactiveMs;
  if (updates.stageStartedAt !== undefined) next.stageStartedAt = updates.stageStartedAt;
  if (updates.stageId !== undefined) next.stageId = updates.stageId;
  if (updates.sourceStageMaxima !== undefined) {
    if (!isSourceStageMaxima(updates.sourceStageMaxima)) return null;
    next.sourceStageMaxima = updates.sourceStageMaxima;
  }
  return next;
};

export const toShapeBuildSessionRecord = (session: BuildSessionRecord): ShapeBuildSessionRecord => ({
  nodeId: session.nodeId,
  status: session.status,
  selectedArrayByCountries: session.selectedArrayByCountries,
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
  progress: toProgressSummary(session.progress, session.stageId),
  stages: { ...session.stages },
  stopReason: session.stopReason,
  lastHeartbeatAt: session.lastHeartbeatAt,
  stageInactiveMs: session.stageInactiveMs,
  stageStartedAt: session.stageStartedAt,
  stageId: session.stageId,
  sourceStageMaxima: isSourceStageMaxima(session.sourceStageMaxima) ? session.sourceStageMaxima : undefined,
});

export const toShapeBuildSessionUpdates = (
  updates: Partial<BuildSessionRecord>,
): Partial<ShapeBuildSessionRecord> => {
  const next: Partial<ShapeBuildSessionRecord> = {};
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.selectedArrayByCountries !== undefined) {
    next.selectedArrayByCountries = updates.selectedArrayByCountries;
  }
  if (updates.startedAt !== undefined) next.startedAt = updates.startedAt;
  if (updates.updatedAt !== undefined) next.updatedAt = updates.updatedAt;
  if (updates.completedAt !== undefined) next.completedAt = updates.completedAt;
  if (updates.progress !== undefined) next.progress = toProgressSummary(updates.progress, updates.stageId);
  if (updates.stages !== undefined) next.stages = { ...updates.stages };
  if (updates.stopReason !== undefined) next.stopReason = updates.stopReason;
  if (updates.lastHeartbeatAt !== undefined) next.lastHeartbeatAt = updates.lastHeartbeatAt;
  if (updates.stageInactiveMs !== undefined) next.stageInactiveMs = updates.stageInactiveMs;
  if (updates.stageStartedAt !== undefined) next.stageStartedAt = updates.stageStartedAt;
  if (updates.stageId !== undefined) next.stageId = updates.stageId;
  if (updates.sourceStageMaxima !== undefined) next.sourceStageMaxima = updates.sourceStageMaxima;
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
