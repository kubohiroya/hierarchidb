import { AuthService } from '@hierarchidb/auth';
import type {
  BuildProgress,
  BuildSessionStatus,
  CanonicalPluginBuildAPI,
  CanonicalPluginBuildStartRequest,
  LegacyCanonicalPluginBuildStartRequest,
  StageKey,
} from '@hierarchidb/build-api';
import { isLegacyCanonicalPluginBuildStartRequest } from '@hierarchidb/build-api';
import { requireCanonicalStageBuildConfig } from '@hierarchidb/build-runtime-services';
import type { BuildSession, ShapeBuildConfig, ShapeProcessingConfig } from '~/common/types/BuildTaskResult';
import { setShapeCorsProxyBaseURL } from '~/services/utils/setShapeCorsProxyBaseURL';
import { shapeBuildAPI } from './api.js';

type ShapeUiStorageBridge = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

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

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`[shape canonical build API] ${label} must be boolean`);
  }
  return value;
};

const requireIntegerInRange = (
  value: unknown,
  label: string,
  minimum: number,
  maximum?: number
): number => {
  if (
    !Number.isInteger(value) ||
    (value as number) < minimum ||
    (maximum !== undefined && (value as number) > maximum)
  ) {
    const constraint =
      maximum === undefined
        ? `at least ${String(minimum)}`
        : `in ${String(minimum)}..${String(maximum)}`;
    throw new Error(`[shape canonical build API] ${label} must be an integer ${constraint}`);
  }
  return value as number;
};

const requireFiniteNumberInRange = (
  value: unknown,
  label: string,
  minimum: number,
  maximum?: number
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    (maximum !== undefined && value > maximum)
  ) {
    const constraint =
      maximum === undefined
        ? `at least ${String(minimum)}`
        : `in ${String(minimum)}..${String(maximum)}`;
    throw new Error(`[shape canonical build API] ${label} must be a finite number ${constraint}`);
  }
  return value;
};

const requireBuildConfig = (value: unknown): ShapeBuildConfig => {
  const config = requireCanonicalStageBuildConfig(value, {
    errorPrefix: 'shape canonical build API',
    label: 'payload.buildConfig',
    requireSourceExecutionFields: false,
    requireGeometryExecutionFields: false,
    requireTileExecutionFields: false,
  });
  if (typeof config.dataSourceName !== 'string' || config.dataSourceName.length === 0) {
    throw new Error(
      '[shape canonical build API] payload.buildConfig.dataSourceName must be a non-empty string'
    );
  }
  return value as ShapeBuildConfig;
};

const requireProcessingConfig = (value: unknown): ShapeProcessingConfig => {
  const config = requireRecord(value, 'payload.processingConfig');
  const source = requireRecord(config.source, 'payload.processingConfig.source');
  requireIntegerInRange(
    source.maxConcurrent,
    'payload.processingConfig.source.maxConcurrent',
    1,
    4
  );
  requireIntegerInRange(source.retryAttempts, 'payload.processingConfig.source.retryAttempts', 0);
  requireFiniteNumberInRange(source.retryDelay, 'payload.processingConfig.source.retryDelay', 0);
  requireIntegerInRange(source.retryLimit, 'payload.processingConfig.source.retryLimit', 0);
  if (source.retryBackoff !== 'linear' && source.retryBackoff !== 'exponential') {
    throw new Error(
      '[shape canonical build API] payload.processingConfig.source.retryBackoff must be linear or exponential'
    );
  }

  const geometry = requireRecord(config.geometry, 'payload.processingConfig.geometry');
  requireIntegerInRange(
    geometry.maxConcurrent,
    'payload.processingConfig.geometry.maxConcurrent',
    1,
    8
  );

  const tileEmit = requireRecord(config.tileEmit, 'payload.processingConfig.tileEmit');
  requireIntegerInRange(
    tileEmit.maxConcurrent,
    'payload.processingConfig.tileEmit.maxConcurrent',
    1
  );
  if (tileEmit.dynamicConcurrency !== undefined) {
    const dynamic = requireRecord(
      tileEmit.dynamicConcurrency,
      'payload.processingConfig.tileEmit.dynamicConcurrency'
    );
    requireBoolean(dynamic.enabled, 'payload.processingConfig.tileEmit.dynamicConcurrency.enabled');
    const minimum = requireIntegerInRange(
      dynamic.minConcurrent,
      'payload.processingConfig.tileEmit.dynamicConcurrency.minConcurrent',
      1
    );
    if (dynamic.maxConcurrent !== undefined) {
      const maximum = requireIntegerInRange(
        dynamic.maxConcurrent,
        'payload.processingConfig.tileEmit.dynamicConcurrency.maxConcurrent',
        1
      );
      if (maximum < minimum) {
        throw new Error(
          '[shape canonical build API] payload.processingConfig.tileEmit.dynamicConcurrency.maxConcurrent must be greater than or equal to minConcurrent'
        );
      }
    }
    const highWatermark = requireFiniteNumberInRange(
      dynamic.highWatermark,
      'payload.processingConfig.tileEmit.dynamicConcurrency.highWatermark',
      0,
      1
    );
    const lowWatermark = requireFiniteNumberInRange(
      dynamic.lowWatermark,
      'payload.processingConfig.tileEmit.dynamicConcurrency.lowWatermark',
      0,
      1
    );
    if (lowWatermark >= highWatermark) {
      throw new Error(
        '[shape canonical build API] payload.processingConfig.tileEmit.dynamicConcurrency.lowWatermark must be less than highWatermark'
      );
    }
    requireIntegerInRange(
      dynamic.adjustStep,
      'payload.processingConfig.tileEmit.dynamicConcurrency.adjustStep',
      1
    );
    requireIntegerInRange(
      dynamic.sampleMs,
      'payload.processingConfig.tileEmit.dynamicConcurrency.sampleMs',
      200
    );
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

const resolveStartPayload = (
  request: CanonicalPluginBuildStartRequest | LegacyCanonicalPluginBuildStartRequest
): unknown =>
  isLegacyCanonicalPluginBuildStartRequest(request) ? request.draftData : request.input.payload;

export const canonicalBuildAPI = {
  startBuildSession: async (request) => {
    const { nodeId } = request;
    const draft = requireRecord(resolveStartPayload(request), 'payload');
    if (!Object.hasOwn(draft, 'buildConfig')) {
      throw new Error('[shape canonical build API] payload.buildConfig is required');
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
  setCorsProxyBaseURL: (url: string): void => setShapeCorsProxyBaseURL(url),
  setUiStorageBridge: async (bridge: ShapeUiStorageBridge): Promise<void> => {
    const auth = await AuthService.getSingleton();
    await auth.setUiStorageBridge(bridge);
  },
  generateDownloadTaskPayloadsFromSelection: (
    ...args: Parameters<typeof shapeBuildAPI.generateDownloadTaskPayloadsFromSelection>
  ) => shapeBuildAPI.generateDownloadTaskPayloadsFromSelection(...args),
};

export {
  canonicalBuildRuntimeAdapter,
  clearShapeBuildRuntimeTransientStatus,
  configureShapeCanonicalBuildRuntimeAdapter,
  setShapeBuildRuntimeInputSource,
  setShapeBuildRuntimeTransientStatus,
} from './configureShapeCanonicalBuildRuntimeAdapter.js';
