/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload, TaskQueueRecord } from '@hierarchidb/build-api';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeBuildStopReason,
} from '@hierarchidb/shape-api';
import type {
  ShapeRuntimeBuildConfig,
} from '~/common/types/index';
import {
  type BuildSession,
  type BuildTask,
  type SelectedArrayByCountries,
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  composeRuntimeBuildConfig,
  applyBuildConfigPatch,
  mergeProcessingConfig,
  requireDataSourceName,
} from '~/common/types/index';
import { ShapeEntityHandler } from '../handlers/index.js';

import {
  type BuildProgressEvent,
  type BuildProgressPayload,
  type BuildTaskSummary,
  type BuildTaskUpdateEvent,
} from '@hierarchidb/build-api';
import type {
  SessionStateChangeEvent,
  SessionHeartbeatEvent,
  TaskProgressEvent,
  SessionStateSubscription,
  StageSnapshotSubscription,
  HeartbeatSubscription,
  TaskProgressSubscription,
} from '~/common/types/session-events';
import { Dexie } from 'dexie';
import {
  VtTaskQueueDb,
  deleteTasksByIds,
  listTasks,
  listTasksByStatus,
  onTaskQueueUpdate,
  putTasks,
} from '@hierarchidb/vt-orchestrator';
import type { BuildSessionConfig, BuildSessionRecord, BuildTaskRecord, StageStatus } from '@hierarchidb/shape-store';
import { ephemeralDB, type EphemeralBuildTaskRecord } from '@hierarchidb/gis-sdk';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
  isTaskSkipped,
  resolveTaskMetadataMessage,
} from '~/common/utils/taskMessages';
import { buildShapeTaskTitle } from '~/common/utils/taskTitles';
import {
  resolveTaskActivityTimestamp,
  resolveTaskProcessingTimestamp,
  selectLatestTaskByProgress,
} from '../taskOrdering.js';
import { getStagePlan } from '~/services/vt/shapeProgressPlan';
import { toBuildSessionRecord } from '~/services/build/shapeSessionMappers';
const mapBuildSessionRecordToBuildSession = (
  record: BuildSessionRecord,
  config: BuildSessionConfig,
): BuildSession => ({
  nodeId: record.nodeId,
  status: record.status,
  config,
  startedAt: record.startedAt,
  updatedAt: record.updatedAt,
  completedAt: record.completedAt,
  progress: record.progress,
  canResume: record.canResume,
  lastActivity: record.lastActivity ?? record.updatedAt,
  expiresAt: record.expiresAt,
  stages: record.stages,
  resourceUsage: record.resourceUsage,
});

const resolveBuildSessionConfig = async (nodeId: NodeId): Promise<BuildSessionConfig> => {
  const handler = getShapeEntityHandler();
  const entity = await handler.getEntity(nodeId);
  const mergedBuildConfig = applyBuildConfigPatch(
    DEFAULT_BUILD_CONFIG,
    entity?.buildConfig ?? {},
  );
  const mergedProcessingConfig = mergeProcessingConfig(
    DEFAULT_PROCESSING_CONFIG,
    entity?.processingConfig ?? {},
  );
  return buildBuildSessionConfig(composeRuntimeBuildConfig(mergedBuildConfig, mergedProcessingConfig));
};

const buildBuildSessionConfig = (buildConfig: ShapeRuntimeBuildConfig): BuildSessionConfig => {
  const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig',
  );
  return {
    dataSource: resolvedDataSource,
    sourceConfig: buildConfig.sourceConfig,
    geometryConfig: buildConfig.geometryConfig,
    vectorTiles: buildConfig.tileEmitConfig,
  };
};

type TaskQueueStatusCounts = {
  total: number;
  running: number;
  completed: number;
  failed: number;
  recycled: number;
};

type CanonicalStageId = 'source-stage' | 'geometry-stage' | 'tile-emit-stage';

const toCanonicalStageId = (stage: TaskQueueRecord['stage']): CanonicalStageId => {
  if (stage === 'source') return 'source-stage';
  if (stage === 'geometry') return 'geometry-stage';
  return 'tile-emit-stage';
};

const isSourceStage = (stage: TaskQueueRecord['stage']): boolean => (
  toCanonicalStageId(stage) === 'source-stage'
);

const isGeometryStage = (stage: TaskQueueRecord['stage']): boolean => (
  toCanonicalStageId(stage) === 'geometry-stage'
);

const isTileEmitStage = (stage: TaskQueueRecord['stage']): boolean => (
  toCanonicalStageId(stage) === 'tile-emit-stage'
);

const countTaskQueueStatuses = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
): Promise<TaskQueueStatusCounts> => {
  const [total, running, completed, failed, recycled] = await Promise.all([
    taskQueue.tasks.where('nodeId').equals(nodeId).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'running']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'completed']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'failed']).count(),
    taskQueue.tasks.where('[nodeId+status]').equals([nodeId, 'recycled']).count(),
  ]);
  return { total, running, completed, failed, recycled };
};

const resolveBuildSessionStatusFromCounts = (
  nodeId: NodeId,
  counts: TaskQueueStatusCounts,
): BuildSession['status'] => {
  const effectiveTotal = Math.max(0, counts.total - counts.recycled);
  if (getPauseState(nodeId).paused) return 'paused';
  if (counts.running > 0) return 'running';
  if (counts.failed > 0) return 'failed';
  if (effectiveTotal > 0 && counts.completed + counts.failed >= effectiveTotal) return 'completed';
  if (effectiveTotal > 0) return 'queued';
  if (counts.recycled > 0) return 'completed';
  return 'idle';
};

const buildProgressFromCounts = (counts: TaskQueueStatusCounts): BuildSession['progress'] => {
  const effectiveTotal = Math.max(0, counts.total - counts.recycled);
  const doneCount = Math.min(effectiveTotal, counts.completed + counts.failed);
  return {
    total: effectiveTotal,
    completed: counts.completed,
    failed: counts.failed,
    skipped: 0,
    percentage: effectiveTotal > 0 ? Math.round((doneCount / effectiveTotal) * 100) : 0,
  };
};

const getBuildSessionInternal = async (nodeId: NodeId): Promise<BuildSession | undefined> => {
  const config = await resolveBuildSessionConfig(nodeId);
  const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
  const buildSession = sessionRecord ? toBuildSessionRecord(sessionRecord) : null;
  if (buildSession) {
    return mapBuildSessionRecordToBuildSession(buildSession, config);
  }

  const taskQueue = new VtTaskQueueDb();
  const counts = await countTaskQueueStatuses(taskQueue, nodeId);
  if (counts.total === 0) return undefined;

  const firstTask = await taskQueue.tasks
    .where('[nodeId+index]')
    .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
    .first();
  const now = Date.now();
  const status = resolveBuildSessionStatusFromCounts(nodeId, counts);
  const progress = buildProgressFromCounts(counts);
  const startedAt = typeof firstTask?.createdAt === 'number' ? firstTask.createdAt : now;

  return {
    nodeId,
    status,
    config,
    startedAt,
    updatedAt: now,
    completedAt: status === 'completed' ? now : undefined,
    progress,
    canResume: status === 'paused',
    lastActivity: now,
    expiresAt: resolveSessionExpiresAt(now),
    stages: {},
    resourceUsage: undefined,
  };
};

export interface ProgressSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildProgressEvent) => void;
}

export interface TaskSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildTaskUpdateEvent) => void;
}

type PauseState = {
  paused: boolean;
  waiters: Array<() => void>;
};

const progressCallbacks = new Map<string, ProgressSubscription>();
const taskCallbacks = new Map<string, TaskSubscription>();
const sessionStateCallbacks = new Map<string, SessionStateSubscription>();
const stageSnapshotCallbacks = new Map<string, StageSnapshotSubscription>();
const heartbeatCallbacks = new Map<string, HeartbeatSubscription>();
const taskProgressCallbacks = new Map<string, TaskProgressSubscription>();
const pauseStates = new Map<string, PauseState>();
const sessionHeartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
const HEARTBEAT_INTERVAL_MS = 1000; // 1 second

const startSessionHeartbeat = (nodeId: NodeId): void => {
  const key = String(nodeId);

  // Clear existing heartbeat if any
  const existingTimer = sessionHeartbeatTimers.get(key);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  const timer = setInterval(() => {
    const subscription = heartbeatCallbacks.get(key);
    if (!subscription?.callback) {
      clearInterval(timer);
      sessionHeartbeatTimers.delete(key);
      return;
    }

    const isActive = activePipelines.has(key);
    const lastActivity = Date.now(); // TODO: Get actual last activity from session

    const event: SessionHeartbeatEvent = {
      nodeId,
      timestamp: Date.now(),
      isActive,
      lastActivity,
    };

    try {
      subscription.callback(event);
    } catch (error) {
      console.error('[shapeBuildAPI] heartbeat callback failed', error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  sessionHeartbeatTimers.set(key, timer);
};

const stopSessionHeartbeat = (nodeId: NodeId): void => {
  const key = String(nodeId);
  const timer = sessionHeartbeatTimers.get(key);
  if (timer) {
    clearInterval(timer);
    sessionHeartbeatTimers.delete(key);
  }
};

const activePipelines = new Set<string>();
const activePipelineRuns = new Map<string, string>();
const sessionSubscriptions = new Map<string, () => void>();
const sessionAbortControllers = new Map<string, AbortController>();
const sessionWorkerInstances = new Map<string, { terminate?: () => void }>();
const STALE_PIPELINE_GRACE_MS = 30_000;

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const resolveEffectiveTaskStatus = (task: TaskQueueRecord): TaskQueueRecord['status'] => {
  if (!isTileEmitStage(task.stage)) return task.status;
  if (task.status !== 'completed') return task.status;
  const progress = typeof task.progress === 'number' ? task.progress : 0;
  const isFinal = typeof task.completedAt === 'number' || progress >= 100;
  return isFinal ? task.status : 'running';
};

const resolveTaskProgress = (task: TaskQueueRecord): number => {
  return task.progress ?? 0;
};

type BuildTaskRecordLike = BuildTaskRecord | EphemeralBuildTaskRecord;

const resolveBuildTaskMetadata = (task: BuildTaskRecordLike): Record<string, unknown> | undefined => {
  if (
    'metadata' in task
    && typeof task.metadata === 'object'
    && task.metadata !== null
  ) {
    return task.metadata;
  }
  return undefined;
};

const resolveTaskMetadataText = (metadata: Record<string, unknown> | undefined): string | null => (
  resolveTaskMetadataMessage(metadata)
);

const resolveBuildTaskRecordMetadataMessage = (task: BuildTaskRecordLike): string | null => (
  resolveTaskMetadataText(resolveBuildTaskMetadata(task))
);

const resolveQueueRecordMetadataMessage = (task: TaskQueueRecord): string | null => (
  resolveTaskMetadataText(task.metadata)
);

const toTaskQueueStatusFromStore = (status: BuildTaskRecordLike['status']): TaskQueueRecord['status'] => {
  if (status === 'failed' || status === 'running') {
    return 'queued';
  }
  return status;
};

const isStopReason = (value: string): value is ShapeBuildStopReason => (
  value === 'route-leave'
  || value === 'user-pause'
  || value === 'failed'
  || value === 'completed'
  || value === 'unknown'
);

const mapBuildTaskToQueueTask = (task: BuildTaskRecordLike): TaskQueueRecord => {
  const nextStatus = toTaskQueueStatusFromStore(task.status);
  const shouldKeepOutput = nextStatus === 'completed' || nextStatus === 'recycled';
  const keepMessage = shouldKeepOutput
    ? (resolveBuildTaskRecordMetadataMessage(task) ?? task.errorMessage)
    : undefined;
  const resolvedProgress = shouldKeepOutput
    ? (Number.isFinite(task.progress) ? Math.min(100, Math.max(0, task.progress)) : 100)
    : 0;
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: task.stage,
    status: nextStatus,
    index: task.index,
    progress: resolvedProgress,
    display: shouldKeepOutput ? task.display : undefined,
    message: keepMessage,
    inputData: task.inputData,
    outputData: shouldKeepOutput ? task.outputData : undefined,
    errorMessage: undefined,
    metadata: resolveBuildTaskMetadata(task),
  };
};

const BUILD_TASK_SEED_BATCH_SIZE = 250;

const seedTaskQueueFromBuildTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  let scannedCount = 0;
  let queuedCount = 0;
  let batch: TaskQueueRecord[] = [];
  let writeChain = Promise.resolve();

  const flushBatch = (): void => {
    if (batch.length === 0) return;
    const nextBatch = batch;
    batch = [];
    queuedCount += nextBatch.length;
    writeChain = writeChain.then(() => putTasks(taskQueue, nextBatch));
  };

  await ephemeralDB.buildTasks
    .where('[nodeId+index]')
    .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
    .each((task) => {
      scannedCount += 1;
      batch.push(mapBuildTaskToQueueTask(task));
      if (batch.length >= BUILD_TASK_SEED_BATCH_SIZE) {
        flushBatch();
      }
    });

  flushBatch();
  await writeChain;

  console.warn('[shapeBuildAPI] seed task queue from build tasks', JSON.stringify({
    nodeId,
    scannedCount,
    queuedCount,
  }));
};

const purgeLegacyBuildTasks = async (_nodeId: NodeId): Promise<number> => {
  return 0;
};

const purgeLegacyTaskQueue = async (nodeId: NodeId, taskQueue: VtTaskQueueDb): Promise<number> => {
  const removedTaskIds: string[] = [];
  const tasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
  tasks.forEach((task) => {
    if (!task.status) {
      removedTaskIds.push(task.taskId);
      return;
    }
    if (task.metadata && typeof task.metadata === 'object') {
      const metadata = task.metadata as Record<string, unknown>;
      if (metadata.cacheReuse === true) {
        removedTaskIds.push(task.taskId);
      }
    }
  });
  if (removedTaskIds.length === 0) return 0;
  await deleteTasksByIds(taskQueue, removedTaskIds);
  console.warn('[shapeBuildAPI] purged legacy task queue records', JSON.stringify({
    nodeId,
    removedCount: removedTaskIds.length,
  }));
  return removedTaskIds.length;
};

const ensureTaskQueueSeeded = async (nodeId: NodeId, taskQueue: VtTaskQueueDb): Promise<void> => {
  await purgeLegacyTaskQueue(nodeId, taskQueue);
  await purgeLegacyBuildTasks(nodeId);
  const existingCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
  if (existingCount > 0) return;
  const buildTaskCount = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).count();
  if (buildTaskCount === 0) return;
  await seedTaskQueueFromBuildTasks(nodeId);
};


const buildTaskSummaryFields = (
  task: TaskQueueRecord,
): {
  title?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
} => ({
  title: buildShapeTaskTitle(task),
  error: task.errorMessage,
  errorMessage: task.errorMessage,
  index: task.index,
  stagePriority: task.stagePriority,
  metadata: task.metadata,
});

const asRecord = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const pickPrimitiveMetadataField = (metadata: Record<string, unknown>, key: string): unknown => {
  const value = metadata[key];
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

const pickRecordMetadataField = (metadata: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
  const value = asRecord(metadata[key]);
  if (!value) return undefined;
  return value;
};

const sanitizeTaskMetadataForSummary = (
  task: TaskQueueRecord,
  preview: Record<string, unknown> | null,
): Record<string, unknown> | undefined => {
  const metadata = asRecord(task.metadata);
  const next: Record<string, unknown> = {};

  if (preview) {
    next.preview = preview;
  }

  if (!metadata) {
    return Object.keys(next).length > 0 ? next : undefined;
  }

  const primitiveKeys = [
    'message',
    'retryAttempt',
    'retryCount',
    'retryLimit',
    'maxRetryAttempts',
    'effectiveTolerance',
    'effective_tolerance',
    'finalTolerance',
    'finalEffectiveTolerance',
    'extractionRatio',
    'retryVertexLimit',
    'vertexLimit',
    'maxVerticesPerFeature',
    'cacheReuse',
    'authState',
  ] as const;

  for (const key of primitiveKeys) {
    const value = pickPrimitiveMetadataField(metadata, key);
    if (value !== undefined) {
      next[key] = value;
    }
  }

  const fetchDetail = pickRecordMetadataField(metadata, 'fetchDetail');
  if (fetchDetail) {
    next.fetchDetail = fetchDetail;
  }

  const tileEmitParentInputSummary = pickRecordMetadataField(metadata, 'tileEmitParentInputSummary');
  if (tileEmitParentInputSummary) {
    next.tileEmitParentInputSummary = tileEmitParentInputSummary;
  }

  const nestedMetadata = pickRecordMetadataField(metadata, 'metadata');
  if (nestedMetadata) {
    const compactNested: Record<string, unknown> = {};
    for (const key of [
      'effectiveTolerance',
      'finalTolerance',
      'extractionRatio',
      'retryCount',
      'retryLimit',
      'maxRetryAttempts',
      'retryVertexLimit',
      'vertexLimit',
      'maxVerticesPerFeature',
    ]) {
      const value = pickPrimitiveMetadataField(nestedMetadata, key);
      if (value !== undefined) {
        compactNested[key] = value;
      }
    }
    if (Object.keys(compactNested).length > 0) {
      next.metadata = compactNested;
    }
  }

  if (isTileEmitStage(task.stage) && !next.tileEmitParentInputSummary) {
    // TileEmit tasks are high-cardinality; avoid carrying non-essential metadata per task.
    return Object.keys(next).length > 0 ? next : undefined;
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

const buildPreviewMetadataFromTask = (task: TaskQueueRecord): Record<string, unknown> | null => {
  const metadata = asRecord(task.metadata);
  const preview = asRecord(metadata?.preview);
  const input = asRecord(task.inputData);
  const output = asRecord(task.outputData);

  if (isSourceStage(task.stage)) {
    const sourceKey = readString(preview?.sourceKey) ?? readString(input?.sourceKey);
    const rawSourceCacheKey = readString(preview?.rawSourceCacheKey);
    const sourceCacheId = readString(preview?.sourceCacheId)
      ?? readString(output?.sourceCacheId)
      ?? (sourceKey ? `${String(task.nodeId)}-shape-${sourceKey}` : null);
    const dataSource = readString(preview?.dataSource) ?? readString(input?.dataSource);
    const sourceUrl = readString(preview?.sourceUrl) ?? readString(input?.url);
    const sourceCountryCode = readString(preview?.sourceCountryCode)
      ?? readString(input?.urlCountryCode)
      ?? readString(input?.countryCode);
    const adminLevel = readNumber(preview?.adminLevel) ?? readNumber(input?.adminLevel);

    if (!sourceCacheId && !sourceKey && !sourceUrl) return preview;
    return {
      stage: 'source',
      sourceKey: sourceKey ?? null,
      dataSource: dataSource ?? null,
      sourceUrl: sourceUrl ?? null,
      sourceCountryCode: sourceCountryCode ?? null,
      adminLevel: adminLevel ?? null,
      rawSourceCacheKey: rawSourceCacheKey ?? null,
      sourceCacheId: sourceCacheId ?? null,
      sourceCacheFormat: readString(preview?.sourceCacheFormat) ?? 'flatgeobuf',
      sourceCacheCompression: readString(preview?.sourceCacheCompression) ?? 'none',
    };
  }

  if (isGeometryStage(task.stage)) {
    const sourceKey = readString(preview?.sourceKey) ?? readString(input?.sourceKey);
    const rawSourceCacheKey = readString(preview?.rawSourceCacheKey);
    const bandIndex = readNumber(preview?.bandIndex) ?? readNumber(input?.bandIndex);
    const domainType = readString(input?.domainType) ?? 'shape';
    const sourceCacheId = readString(preview?.sourceCacheId) ?? readString(input?.sourceCacheId);
    const geometryCacheId = readString(preview?.geometryCacheId)
      ?? readString(output?.geometryCacheId)
      ?? (sourceKey && bandIndex !== null
        ? `${String(task.nodeId)}-b${Math.floor(bandIndex)}-${domainType}-${sourceKey}`
        : null);
    const sourceCountryCode = readString(preview?.sourceCountryCode)
      ?? readString(input?.sourceCountryCode)
      ?? readString(input?.countryCode);
    const adminLevel = readNumber(preview?.adminLevel) ?? readNumber(input?.adminLevel);

    if (!sourceCacheId && !geometryCacheId && !sourceKey) return preview;
    return {
      stage: 'geometry',
      sourceKey: sourceKey ?? null,
      bandIndex: bandIndex ?? null,
      dataSource: readString(preview?.dataSource) ?? readString(input?.dataSource) ?? null,
      sourceUrl: readString(preview?.sourceUrl) ?? readString(input?.sourceUrl) ?? null,
      sourceCountryCode: sourceCountryCode ?? null,
      adminLevel: adminLevel ?? null,
      rawSourceCacheKey: rawSourceCacheKey ?? null,
      sourceCacheId: sourceCacheId ?? null,
      sourceCacheFormat: readString(preview?.sourceCacheFormat) ?? readString(input?.sourceCacheFormat) ?? 'flatgeobuf',
      sourceCacheCompression: readString(preview?.sourceCacheCompression) ?? readString(input?.sourceCacheCompression) ?? 'none',
      geometryCacheId: geometryCacheId ?? null,
    };
  }

  return preview;
};

const mapTaskQueueRecordToTaskSummary = (
  task: TaskQueueRecord,
): ShapeBuildTaskSummary => {
  const base = buildTaskSummaryFields(task);
  const preview = buildPreviewMetadataFromTask(task);
  const metadata = sanitizeTaskMetadataForSummary(task, preview);
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: task.stage,
    stageId: toCanonicalStageId(task.stage),
    status: resolveEffectiveTaskStatus(task),
    progress: resolveTaskProgress(task),
    display: task.display,
    title: base.title,
    error: base.error,
    errorMessage: base.errorMessage,
    index: base.index,
    stagePriority: base.stagePriority,
    metadata,
  };
};

type ShapeBuildTaskSummary = BuildTaskSummary & {
  nodeId?: NodeId;
  title?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
};

type ProgressTaskMeta = {
  taskId: string;
  status: TaskQueueRecord['status'];
  stage: TaskQueueRecord['stage'];
  progress: number;
  title?: string;
  display?: TaskDisplayPayload;
};

const resolveTaskType = (tasks: TaskQueueRecord[]): TaskQueueRecord['stage'] | undefined => {
  const stageOrder: CanonicalStageId[] = ['source-stage', 'geometry-stage', 'tile-emit-stage'];
  const matchedStageId = stageOrder.find((stageId) => (
    tasks.some((task) => {
      const status = resolveEffectiveTaskStatus(task);
      return toCanonicalStageId(task.stage) === stageId
        && status !== 'completed'
        && status !== 'failed'
        && status !== 'recycled';
    })
  ));
  if (matchedStageId === 'source-stage') return 'source';
  if (matchedStageId === 'geometry-stage') return 'geometry';
  if (matchedStageId === 'tile-emit-stage') return 'tileEmit';
  return undefined;
};

const summarizeTaskQueueStatus = (tasks: TaskQueueRecord[]) => {
  const nonRecycled = tasks.filter((task) => resolveEffectiveTaskStatus(task) !== 'recycled');
  const total = nonRecycled.length;
  const completed = nonRecycled.filter((task) => {
    const status = resolveEffectiveTaskStatus(task);
    return status === 'completed' && !isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task));
  }).length;
  const failed = nonRecycled.filter((task) => resolveEffectiveTaskStatus(task) === 'failed').length;
  const skipped = nonRecycled.filter((task) => isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))).length;
  const doneCount = Math.min(total, completed + skipped + failed);
  const hasRecycled = tasks.length > total;
  const status: BuildTask['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : total > 0
        ? 'running'
        : hasRecycled
          ? 'completed'
          : 'idle';
  return {
    status,
    stage: resolveTaskType(tasks),
  };
};

const summarizeTaskQueueProgress = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  stage?: TaskQueueRecord['stage'],
): Promise<ShapeBuildProgressSummary> => {
  const stageCounts: Record<TaskQueueRecord['stage'], {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    recycled: number;
  }> = {
    source: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    geometry: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    tileEmit: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
  };
  tasks.forEach((task) => {
    const bucket = stageCounts[task.stage];
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      bucket.recycled += 1;
      return;
    }
    bucket.total += 1;
    if (isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))) {
      bucket.skipped += 1;
      return;
    }
    if (status === 'failed') {
      bucket.failed += 1;
      return;
    }
    if (status === 'completed') {
      bucket.completed += 1;
    }
  });
  const completed = stageCounts.source.completed + stageCounts.geometry.completed + stageCounts.tileEmit.completed;
  const failed = stageCounts.source.failed + stageCounts.geometry.failed + stageCounts.tileEmit.failed;
  const skipped = stageCounts.source.skipped + stageCounts.geometry.skipped + stageCounts.tileEmit.skipped;
  const plan = getStagePlan(nodeId);
  const resolveStageTotal = (
    counts: typeof stageCounts[keyof typeof stageCounts],
    planned?: number,
  ): number => {
    if (typeof planned !== 'number') return counts.total;
    const adjustedPlan = Math.max(0, planned - counts.recycled);
    return Math.max(counts.total, adjustedPlan);
  };
  const total = resolveStageTotal(stageCounts.source, plan?.sourceTotal)
    + resolveStageTotal(stageCounts.geometry, plan?.geometryTotal)
    + resolveStageTotal(stageCounts.tileEmit);
  let resolvedStage = stage;
  if (!resolvedStage && tasks.length === 0 && plan?.sourceTotal && plan.sourceTotal > 0) {
    resolvedStage = 'source';
  }
  if (!resolvedStage && tasks.length === 0 && plan?.geometryTotal && plan.geometryTotal > 0) {
    resolvedStage = 'geometry';
  }
  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    stage: resolvedStage,
  };
};

const buildTaskQueueSummary = async (nodeId: NodeId, tasks: TaskQueueRecord[]) => {
  const statusSummary = summarizeTaskQueueStatus(tasks);
  const progress = await summarizeTaskQueueProgress(nodeId, tasks, statusSummary.stage);
  return {
    status: statusSummary.status,
    progress,
  };
};

const buildTaskSummarySnapshot = async (
  nodeId: NodeId,
  taskQueue: VtTaskQueueDb,
): Promise<ShapeBuildTaskSummary[]> => {
  const tasks = await listTasks(taskQueue, nodeId);
  const statusSummary: Record<string, number> = {};
  const stageSummary: Record<string, number> = {};
  for (const task of tasks) {
    statusSummary[task.status] = (statusSummary[task.status] ?? 0) + 1;
    stageSummary[task.stage] = (stageSummary[task.stage] ?? 0) + 1;
  }
  console.log('[shapeBuildAPI] buildTaskSummarySnapshot', JSON.stringify({
    nodeId,
    total: tasks.length,
    statusSummary,
    stageSummary,
  }));
  return tasks.map((task) => mapTaskQueueRecordToTaskSummary(task));
};

const buildProgressPayloadFromTasks = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  options?: { eventTask?: TaskQueueRecord; source?: 'event' | 'snapshot' },
): Promise<BuildProgressPayload> => {
  const summary = await summarizeTaskQueueProgress(nodeId, tasks, resolveTaskType(tasks));
  const stageStatusMap = buildStageStatusMap(nodeId, tasks);
  const progressTask = options?.eventTask ?? selectLatestTaskByProgress(tasks) ?? undefined;
  const meta: Record<string, unknown> = {};
  if (progressTask) {
    const progressTaskSummary = buildTaskSummaryFields(progressTask);
    const progressTaskMeta: ProgressTaskMeta = {
      taskId: progressTask.taskId,
      status: progressTask.status,
      stage: progressTask.stage,
      progress: resolveTaskProgress(progressTask),
      title: progressTaskSummary.title,
      display: progressTask.display,
    };
    meta.progressTask = progressTaskMeta;
  }
  if (options?.source) {
    meta.source = options.source;
  }
  meta.stageTotals = {
    source: {
      total: stageStatusMap.source.tasksTotal,
      completed: stageStatusMap.source.tasksCompleted,
      failed: stageStatusMap.source.tasksFailed,
    },
    geometry: {
      total: stageStatusMap.geometry.tasksTotal,
      completed: stageStatusMap.geometry.tasksCompleted,
      failed: stageStatusMap.geometry.tasksFailed,
    },
    tileEmit: {
      total: stageStatusMap.tileEmit.tasksTotal,
      completed: stageStatusMap.tileEmit.tasksCompleted,
      failed: stageStatusMap.tileEmit.tasksFailed,
    },
  };
  return {
    total: summary.total,
    completed: summary.completed,
    failed: summary.failed,
    skipped: summary.skipped,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
};

const buildStageStatus = (tasks: TaskQueueRecord[], plannedTotal?: number): StageStatus => {
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  let recycled = 0;
  let actualTotal = 0;
  tasks.forEach((task) => {
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      recycled += 1;
      return;
    }
    actualTotal += 1;
    if (status === 'failed') {
      failed += 1;
      return;
    }
    if (status === 'completed') {
      if (isTaskSkipped(task.display, resolveQueueRecordMetadataMessage(task))) {
        skipped += 1;
      } else {
        completed += 1;
      }
      return;
    }
    if (status === 'running') {
      running += 1;
    }
  });
  const adjustedPlannedTotal = typeof plannedTotal === 'number'
    ? Math.max(0, plannedTotal - recycled)
    : undefined;
  const total = typeof adjustedPlannedTotal === 'number'
    ? Math.max(adjustedPlannedTotal, actualTotal)
    : actualTotal;
  const doneCount = Math.min(total, completed + skipped + failed);
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const status: StageStatus['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : running > 0
        ? 'running'
        : recycled > 0
          ? 'completed'
          : 'queued';
  return {
    status,
    progress,
    tasksTotal: total,
    tasksCompleted: completed + skipped,
    tasksFailed: failed,
  };
};

const buildStageStatusMap = (
  nodeId: NodeId,
  tasks: TaskQueueRecord[]
): Record<TaskQueueRecord['stage'], StageStatus> => {
  const plan = getStagePlan(nodeId);
  const sourceTasks = tasks.filter((task) => isSourceStage(task.stage));
  const geometryTasks = tasks.filter((task) => isGeometryStage(task.stage));
  const tileEmitTasks = tasks.filter((task) => isTileEmitStage(task.stage));
  return {
    source: buildStageStatus(sourceTasks, plan?.sourceTotal),
    geometry: buildStageStatus(geometryTasks, plan?.geometryTotal),
    tileEmit: buildStageStatus(tileEmitTasks),
  };
};

const resolveSessionStatus = (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
): ShapeBuildSessionRecord['status'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  return summarizeTaskQueueStatus(tasks).status;
};

const resolveSessionLastActivity = (tasks: TaskQueueRecord[]): number => {
  const latest = selectLatestTaskByProgress(tasks);
  const timestamp = latest ? resolveTaskActivityTimestamp(latest) : Date.now();
  return timestamp > 0 ? timestamp : Date.now();
};

const resolveSessionExpiresAt = (lastActivity: number): number => (
  lastActivity + 5 * 60 * 1000
);

const updateBuildSessionFromTasks = async (
  nodeId: NodeId,
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): Promise<void> => {
  try {
    const taskQueue = new VtTaskQueueDb();
    const tasks = await listTasks(taskQueue, nodeId);
    const status = overrides?.status ?? resolveSessionStatus(nodeId, tasks);
    await upsertBuildSessionSnapshot({
      nodeId,
      tasks,
      status,
      stopReason: overrides?.stopReason,
      canResume: overrides?.canResume,
      completedAt: overrides?.completedAt,
    });
  } catch (error) {
    console.warn('[shapeBuildAPI] build session update failed', error);
  }
};

const upsertBuildSessionSnapshot = async (
  input: {
    nodeId: NodeId;
    selectedArrayByCountries?: SelectedArrayByCountries;
    tasks?: TaskQueueRecord[];
    status: ShapeBuildSessionRecord['status'];
    startedAt?: number;
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): Promise<void> => {
  const now = Date.now();
  const existing = await shapeQueryAPIImpl.getBuildSessionRecord(input.nodeId).catch(() => null);
  const previousStatus = existing?.status;
  const isTransitionToPaused = input.status === 'paused' && previousStatus === 'running';
  const lastHeartbeatAt = typeof existing?.lastHeartbeatAt === 'number'
    ? existing.lastHeartbeatAt
    : typeof existing?.updatedAt === 'number'
      ? existing.updatedAt
      : now;
  const pauseDeltaMs = isTransitionToPaused
    ? Math.max(0, now - lastHeartbeatAt)
    : 0;
  const inactiveMs = Math.max(0, (existing?.inactiveMs ?? 0) + pauseDeltaMs);
  const progress = input.tasks
    ? await summarizeTaskQueueProgress(input.nodeId, input.tasks, resolveTaskType(input.tasks))
    : (existing?.progress ?? {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    });
  const stages = input.tasks ? buildStageStatusMap(input.nodeId, input.tasks) : (existing?.stages ?? {});
  const startedAt = existing?.startedAt ?? input.startedAt ?? now;
  const lastActivity = input.tasks
    ? resolveSessionLastActivity(input.tasks)
    : (existing?.lastActivity ?? now);
  const expiresAt = input.tasks
    ? resolveSessionExpiresAt(lastActivity)
    : (existing?.expiresAt ?? resolveSessionExpiresAt(lastActivity));
  const record: ShapeBuildSessionRecord = {
    nodeId: input.nodeId,
    status: input.status,
    selectedArrayByCountries: input.selectedArrayByCountries ?? existing?.selectedArrayByCountries,
    startedAt,
    updatedAt: now,
    completedAt: input.completedAt,
    progress,
    stages,
    stopReason: input.stopReason,
    canResume: input.canResume,
    lastActivity,
    expiresAt,
    inactiveMs,
    lastHeartbeatAt: now,
    stageInactiveMs: existing?.stageInactiveMs,
    stageStartedAt: existing?.stageStartedAt,
    stageHeartbeatAt: existing?.stageHeartbeatAt,
    stageId: existing?.stageId,
    sourceStageMaxima: existing?.sourceStageMaxima,
  };
  await shapeMutationAPIImpl.upsertBuildSession(record);

  // Emit session state change event if status changed
  if (previousStatus !== input.status) {
    emitSessionStateChange(input.nodeId, previousStatus, input.status, record);
  }
};

type BuildSessionUpdateState = {
  timer: ReturnType<typeof setTimeout> | null;
  pending: boolean;
  running: boolean;
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  };
};

const BUILD_SESSION_UPDATE_DEBOUNCE_MS = 1000;
const buildSessionUpdateStates = new Map<string, BuildSessionUpdateState>();

const scheduleBuildSessionUpdate = (
  nodeId: NodeId,
  overrides?: {
    status?: ShapeBuildSessionRecord['status'];
    stopReason?: ShapeBuildStopReason;
    canResume?: boolean;
    completedAt?: number;
  },
): void => {
  const key = String(nodeId);
  const state = buildSessionUpdateStates.get(key) ?? {
    timer: null,
    pending: false,
    running: false,
  };
  if (!state.running && state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.pending = true;
  state.overrides = overrides ?? state.overrides;
  const run = async () => {
    if (state.running) return;
    state.timer = null;
    state.running = true;
    try {
      const nextOverrides = state.overrides;
      state.overrides = undefined;
      state.pending = false;
      await updateBuildSessionFromTasks(nodeId, nextOverrides);
    } finally {
      state.running = false;
      if (state.pending) {
        state.timer = setTimeout(run, BUILD_SESSION_UPDATE_DEBOUNCE_MS);
      }
    }
  };
  state.timer = setTimeout(run, BUILD_SESSION_UPDATE_DEBOUNCE_MS);
  buildSessionUpdateStates.set(key, state);
};

const startSessionTracking = (nodeId: NodeId): void => {
  const key = String(nodeId);
  if (sessionSubscriptions.has(key)) return;
  const unsubscribe = onTaskQueueUpdate(nodeId, (event) => {
    scheduleBuildSessionUpdate(nodeId);

    // Emit task progress event
    if (event.type === 'update') {
      emitTaskProgress(
        event.nodeId,
        event.task.taskId,
        event.task.stage,
        event.task.progress ?? 0,
        event.task.status,
        event.task.metadata,
      );
    }
  });
  sessionSubscriptions.set(key, unsubscribe);

  // Start heartbeat for this session
  startSessionHeartbeat(nodeId);
};

const stopSessionTracking = (nodeId: NodeId): void => {
  const key = String(nodeId);
  const unsubscribe = sessionSubscriptions.get(key);
  if (unsubscribe) {
    unsubscribe();
  }
  sessionSubscriptions.delete(key);

  // Stop heartbeat for this session
  stopSessionHeartbeat(nodeId);
};

const readPipelineStartedAt = (nodeId: NodeId): number | null => {
  const runId = activePipelineRuns.get(String(nodeId));
  if (!runId) return null;
  const separator = runId.lastIndexOf(':');
  if (separator <= 0 || separator >= runId.length - 1) return null;
  const parsed = Number(runId.slice(separator + 1));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const clearActivePipelineRuntimeState = (nodeId: NodeId): void => {
  const pipelineKey = String(nodeId);
  activePipelines.delete(pipelineKey);
  activePipelineRuns.delete(pipelineKey);
  pauseStates.delete(pipelineKey);
  sessionAbortControllers.delete(pipelineKey);
  sessionWorkerInstances.delete(pipelineKey);
  stopSessionTracking(nodeId);

  // Clean up all session callbacks
  sessionStateCallbacks.delete(pipelineKey);
  stageSnapshotCallbacks.delete(pipelineKey);
  heartbeatCallbacks.delete(pipelineKey);
  taskProgressCallbacks.delete(pipelineKey);
};

const clearStalePipelineStateIfInactive = async (
  nodeId: NodeId,
  sessionRecord: ShapeBuildSessionRecord | null,
  source: 'startBuildSession',
): Promise<boolean> => {
  const pipelineKey = String(nodeId);
  if (!activePipelines.has(pipelineKey)) return false;
  const now = Date.now();
  const pipelineStartedAt = readPipelineStartedAt(nodeId);
  if (pipelineStartedAt !== null && now - pipelineStartedAt < STALE_PIPELINE_GRACE_MS) {
    return false;
  }
  const sessionUpdatedAt = sessionRecord?.updatedAt;
  if (typeof sessionUpdatedAt === 'number' && now - sessionUpdatedAt < STALE_PIPELINE_GRACE_MS) {
    return false;
  }
  const taskQueue = new VtTaskQueueDb();
  const [runningTasks, queuedTasks] = await Promise.all([
    listTasksByStatus(taskQueue, nodeId, 'running'),
    listTasksByStatus(taskQueue, nodeId, 'queued'),
  ]);
  if (runningTasks.length > 0 || queuedTasks.length > 0) return false;
  clearActivePipelineRuntimeState(nodeId);
  console.warn('[shapeBuildAPI] stale pipeline state cleared', {
    nodeId,
    source,
    sessionStatus: sessionRecord?.status ?? null,
    runningTaskCount: runningTasks.length,
    queuedTaskCount: queuedTasks.length,
  });
  return true;
};

const getPauseState = (nodeId: NodeId): PauseState => {
  const key = String(nodeId);
  const existing = pauseStates.get(key);
  if (existing) return existing;
  const state: PauseState = { paused: false, waiters: [] };
  pauseStates.set(key, state);
  return state;
};

const waitIfPaused = async (nodeId: NodeId): Promise<void> => {
  const state = getPauseState(nodeId);
  if (!state.paused) return;
  const startedAt = Date.now();
  console.warn('[shapeBuildAPI][PauseTrace] wait-enter', {
    nodeId,
    waitersBefore: state.waiters.length,
  });
  await new Promise<void>((resolve) => {
    state.waiters.push(resolve);
  });
  console.warn('[shapeBuildAPI][PauseTrace] wait-exit', {
    nodeId,
    elapsedMs: Date.now() - startedAt,
    waitersRemaining: state.waiters.length,
  });
};

const setPaused = (nodeId: NodeId, paused: boolean): void => {
  const state = getPauseState(nodeId);
  state.paused = paused;
  console.warn('[shapeBuildAPI][PauseTrace] state-update', {
    nodeId,
    paused,
    waiters: state.waiters.length,
    pipelineActive: activePipelines.has(String(nodeId)),
  });
  if (!paused && state.waiters.length > 0) {
    const pending = [...state.waiters];
    state.waiters.length = 0;
    pending.forEach((resolve) => { resolve() });
  }
};

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): BuildProgressEvent['phase'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  const status = summarizeTaskQueueStatus(tasks).status;
  if (status === 'completed' && activePipelines.has(String(nodeId))) {
    return 'running';
  }
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
};

const emitSessionStateChange = (
  nodeId: NodeId,
  previousStatus: ShapeBuildSessionRecord['status'] | undefined,
  currentStatus: ShapeBuildSessionRecord['status'],
  sessionRecord: ShapeBuildSessionRecord,
): void => {
  const key = String(nodeId);
  const subscription = sessionStateCallbacks.get(key);
  if (!subscription?.callback) return;

  const event: SessionStateChangeEvent = {
    nodeId,
    timestamp: Date.now(),
    previousStatus,
    currentStatus,
    sessionRecord,
  };

  try {
    subscription.callback(event);
  } catch (error) {
    console.error('[shapeBuildAPI] session state change callback failed', error);
  }
};

const emitTaskProgress = (
  nodeId: NodeId,
  taskId: string,
  stage: string,
  progress: number,
  status: string,
  metadata?: Record<string, unknown>,
): void => {
  const key = String(nodeId);
  const subscription = taskProgressCallbacks.get(key);
  if (!subscription?.callback) return;

  const event: TaskProgressEvent = {
    nodeId,
    timestamp: Date.now(),
    taskId,
    stage,
    progress,
    status,
    metadata,
  };

  try {
    subscription.callback(event);
  } catch (error) {
    console.error('[shapeBuildAPI] task progress callback failed', error);
  }
};

const emitProgressSnapshot = async (
  nodeId: NodeId,
  message?: string,
): Promise<void> => {
  const sub = progressCallbacks.get(String(nodeId));
  if (!sub?.callback) {
    if (typeof message === 'string' && message.length > 0) {
      console.warn('[shapeBuildAPI] progress snapshot skipped (no subscriber)', JSON.stringify({
        nodeId,
        message,
      }));
    }
    return;
  }
  try {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    const phase = resolveProgressPhase(nodeId, vtTasks);
    const statusSummary = summarizeTaskQueueStatus(vtTasks);
    const payload = await buildProgressPayloadFromTasks(nodeId, vtTasks, { source: 'snapshot' });
    sub.callback({
      nodeId,
      stage: statusSummary.stage ?? 'source',
      phase,
      timestamp: Date.now(),
      message,
      payload,
    });
  } catch (error) {
    console.error('[shapeBuildAPI] progress snapshot build failed', error);
  }
};

export const shapeBuildRuntimeExecutionMetrics = {
  getBuildSessionInternal,
  ensureTaskQueueSeeded,
  mapTaskQueueRecordToTaskSummary,
  activePipelines,
  activePipelineRuns,
  sessionAbortControllers,
  sessionWorkerInstances,
  seedTaskQueueFromBuildTasks,
  isStopReason,
  buildTaskQueueSummary,
  getPauseState,
  resolveSessionExpiresAt,
  countTaskQueueStatuses,
  emitProgressSnapshot,
  resolveProgressPhase,
  buildProgressPayloadFromTasks,
  selectLatestTaskByProgress,
  resolveTaskProcessingTimestamp,
  listTasks,
  getShapeEntityHandler,
  onTaskQueueUpdate,
  buildTaskSummarySnapshot,
  waitIfPaused,
  setPaused,
  startSessionTracking,
  clearStalePipelineStateIfInactive,
  clearActivePipelineRuntimeState,
  summarizeTaskQueueStatus,
  progressCallbacks,
  taskCallbacks,
  sessionStateCallbacks,
  stageSnapshotCallbacks,
  heartbeatCallbacks,
  taskProgressCallbacks,
  upsertBuildSessionSnapshot,
  updateBuildSessionFromTasks,
  resolveTaskActivityTimestamp,
  buildBuildSessionConfig,
} as const;

export type ShapeBuildRuntimeExecutionMetrics = typeof shapeBuildRuntimeExecutionMetrics;
