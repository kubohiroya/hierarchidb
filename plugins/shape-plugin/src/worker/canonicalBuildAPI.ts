import type {
  BuildProgress,
  BuildSessionStatus,
  CanonicalPluginBuildAPI,
  StageKey,
} from '@hierarchidb/build-api';
import { requireCanonicalStageBuildConfig } from '@hierarchidb/build-runtime-services';
import type { BuildSession, ShapeBuildConfig, ShapeProcessingConfig } from '~/common/types/index';
import { shapeBuildAPI } from './api.js';

const BUILD_SESSION_STATUSES = new Set<BuildSessionStatus['status']>([
  'idle',
  'queued',
  'running',
  'pausing',
  'paused',
  'completed',
  'failed',
]);

const STAGES = new Set<StageKey>(['source', 'geometry', 'tileEmit']);

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[shape canonical build API] ${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const requireBuildConfig = (value: unknown): ShapeBuildConfig => {
  const config = requireCanonicalStageBuildConfig(value, {
    errorPrefix: 'shape canonical build API',
    label: 'draftData.buildConfig',
    requireSourceExecutionFields: false,
    requireGeometryExecutionFields: false,
    requireTileExecutionFields: false,
  });
  if (typeof config.dataSourceName !== 'string' || config.dataSourceName.length === 0) {
    throw new Error(
      '[shape canonical build API] draftData.buildConfig.dataSourceName must be a non-empty string'
    );
  }
  return value as ShapeBuildConfig;
};

const requireProcessingConfig = (value: unknown): ShapeProcessingConfig => {
  const config = requireRecord(value, 'draftData.processingConfig');
  for (const field of ['source', 'geometry', 'tileEmit']) {
    requireRecord(config[field], `draftData.processingConfig.${field}`);
  }
  return value as ShapeProcessingConfig;
};

const requireTaskCount = (value: unknown, label: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(
      `[shape canonical build API] ${label} must be a non-negative integer, received ${String(value)}`
    );
  }
  return value as number;
};

const requirePercentage = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `[shape canonical build API] progress.percentage must be finite 0..100, received ${String(value)}`
    );
  }
  return value;
};

const requireStage = (value: unknown): StageKey => {
  if (!STAGES.has(value as StageKey)) {
    throw new Error(
      `[shape canonical build API] progress stage must be source, geometry, or tileEmit, received ${String(value)}`
    );
  }
  return value as StageKey;
};

const toBuildProgress = (session: BuildSession): BuildProgress => {
  const progress = requireRecord(session.progress, 'session.progress');
  const total = requireTaskCount(progress.total, 'progress.total');
  const completed = requireTaskCount(progress.completed, 'progress.completed');
  const failed = requireTaskCount(progress.failed, 'progress.failed');
  const skipped = requireTaskCount(progress.skipped, 'progress.skipped');
  const terminal = completed + failed + skipped;
  if (terminal > total) {
    throw new Error(
      `[shape canonical build API] terminal task count must not exceed total: terminal=${terminal}, total=${total}`
    );
  }
  const stage = session.stageId === undefined ? undefined : requireStage(session.stageId);
  return {
    total,
    completed,
    failed,
    skipped,
    percentage: requirePercentage(progress.percentage),
    ...(stage === undefined ? {} : { stage }),
  };
};

const toBuildSessionStatus = (
  session: BuildSession | undefined,
  nodeId: BuildSessionStatus['nodeId']
): BuildSessionStatus => {
  if (!session) {
    throw new Error(`[shape canonical build API] session not found: ${String(nodeId)}`);
  }
  if (session.nodeId !== nodeId) {
    throw new Error(
      `[shape canonical build API] session nodeId mismatch: expected=${String(nodeId)}, actual=${String(session.nodeId)}`
    );
  }
  if (!BUILD_SESSION_STATUSES.has(session.status as BuildSessionStatus['status'])) {
    throw new Error(
      `[shape canonical build API] invalid session status: ${String(session.status)}`
    );
  }
  return {
    nodeId,
    status: session.status as BuildSessionStatus['status'],
    progress: toBuildProgress(session),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    lastActivity: session.lastActivity,
  };
};

const getBuildSessionStatus = async (
  nodeId: BuildSessionStatus['nodeId']
): Promise<BuildSessionStatus> =>
  toBuildSessionStatus(await shapeBuildAPI.getBuildSession(nodeId), nodeId);

export const canonicalBuildAPI = {
  startBuildSession: async ({ nodeId, draftData }) => {
    const draft = requireRecord(draftData, 'draftData');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[shape canonical build API] draftData.buildConfig is required');
    }
    const buildConfig = requireBuildConfig(draft.buildConfig);
    const processingConfig = Object.hasOwn(draft, 'processingConfig')
      ? requireProcessingConfig(draft.processingConfig)
      : undefined;
    await shapeBuildAPI.startBuildSession(nodeId, buildConfig, processingConfig, []);
    return getBuildSessionStatus(nodeId);
  },
  getBuildSessionStatus,
  pauseBuildSession: (nodeId, reason) => shapeBuildAPI.pauseBuildSession(nodeId, reason),
  cancelQueuedBuildSession: (nodeId, reason) =>
    shapeBuildAPI.cancelQueuedBuildSession(nodeId, reason),
  getBuildTasks: (nodeId) => shapeBuildAPI.getBuildTasks(nodeId),
  subscribeStageSnapshots: (nodeId, callback) =>
    shapeBuildAPI.subscribeStageSnapshots(nodeId, callback),
  subscribeTaskProgress: (nodeId, callback) =>
    shapeBuildAPI.subscribeTaskProgress(nodeId, callback),
  subscribeSessionState: (nodeId, callback) =>
    shapeBuildAPI.subscribeSessionState(nodeId, callback),
  subscribeSessionHeartbeat: (nodeId, callback) =>
    shapeBuildAPI.subscribeHeartbeat(nodeId, callback),
  subscribeWorkerLog: (nodeId, callback) => shapeBuildAPI.subscribeWorkerLog(nodeId, callback),
} satisfies CanonicalPluginBuildAPI;

export const shapeBuildExtensions = {
  generateDownloadTaskPayloadsFromSelection: (
    ...args: Parameters<typeof shapeBuildAPI.generateDownloadTaskPayloadsFromSelection>
  ) => shapeBuildAPI.generateDownloadTaskPayloadsFromSelection(...args),
};
