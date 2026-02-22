/**
 * Worker API implementation for Shape plugin
 * Exposes build-oriented operations for runtime worker adapters
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload, TaskQueueRecord } from '@hierarchidb/batch-api';
import type { ShapeBuildSessionRecord, ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type {
  ShapeRuntimeBuildConfig,
} from '~/common/types/index';
import {
  type BuildSession,
  type BuildTask,
  type ProgressInfo,
  type SelectedArrayByCountries,
  DEFAULT_BUILD_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  composeRuntimeBuildConfig,
  mergeBuildConfig,
  mergeProcessingConfig,
  requireDataSourceName,
} from '~/common/types/index';
import { ShapeEntityHandler } from '../handlers/index.js';

import {
  type BuildProgressEvent,
  type BuildProgressPayload,
  type BuildTaskSummary,
  type BuildTaskUpdateEvent,
  type ProgressPhase,
} from '@hierarchidb/batch-api';
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
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/batch/ShapeBuildAPIClient';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { buildShapeTaskTitle } from '~/common/utils/taskTitles';
import {
  resolveTaskActivityTimestamp,
  resolveTaskProcessingTimestamp,
  selectLatestTaskByProgress,
} from '../taskOrdering.js';
import { getStagePlan } from '~/services/vt/shapeProgressPlan';
import { toBuildSessionRecord } from '~/services/batch/shapeSessionMappers';
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
  const mergedBuildConfig = mergeBuildConfig(
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
    fetchConfig: buildConfig.fetchConfig,
    transformConfig: buildConfig.transformConfig,
    vectorTiles: buildConfig.vtConfig,
  };
};

type TaskQueueStatusCounts = {
  total: number;
  running: number;
  completed: number;
  failed: number;
  recycled: number;
};

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
const pauseStates = new Map<string, PauseState>();
const activePipelines = new Set<string>();
const activePipelineRuns = new Map<string, string>();
const sessionSubscriptions = new Map<string, () => void>();
const STALE_PIPELINE_GRACE_MS = 30_000;

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const resolveEffectiveTaskStatus = (task: TaskQueueRecord): TaskQueueRecord['status'] => {
  if (task.stage !== 'vt') return task.status;
  if (task.status !== 'completed') return task.status;
  const progress = typeof task.progress === 'number' ? task.progress : 0;
  const isFinal = typeof task.completedAt === 'number' || progress >= 100;
  return isFinal ? task.status : 'running';
};

const resolveTaskProgress = (task: TaskQueueRecord): number => {
  return task.progress ?? 0;
};

const validTaskStages: TaskQueueRecord['stage'][] = ['fetch', 'transform', 'vt'];
const validTaskStatuses: TaskQueueRecord['status'][] = [
  'queued',
  'running',
  'completed',
  'failed',
  'recycled',
];

const isValidTaskStage = (value: unknown): value is TaskQueueRecord['stage'] => (
  typeof value === 'string' && validTaskStages.includes(value as TaskQueueRecord['stage'])
);

const isValidTaskStatus = (value: unknown): value is TaskQueueRecord['status'] => (
  typeof value === 'string' && validTaskStatuses.includes(value as TaskQueueRecord['status'])
);

const normalizeTaskPhase = (status: TaskQueueRecord['status']): ProgressPhase => status;


type BuildTaskRecordLike = BuildTaskRecord | EphemeralBuildTaskRecord;

const resolveBuildTaskStage = (
  task: BuildTaskRecordLike
): TaskQueueRecord['stage'] | undefined => {
  const stageValue = (task as { stage?: unknown }).stage;
  return isValidTaskStage(stageValue) ? stageValue : undefined;
};

const normalizeResumedTaskStatus = (status: BuildTaskRecordLike['status']): TaskQueueRecord['status'] => {
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
  const nextStatus = normalizeResumedTaskStatus(task.status);
  const taskStage = resolveBuildTaskStage(task);
  if (!taskStage) {
    throw new Error('[shapeBuildAPI] task stage missing while mapping to queue');
  }
  const shouldKeepOutput = nextStatus === 'completed' || nextStatus === 'recycled';
  const resolvedProgress = shouldKeepOutput
    ? (Number.isFinite(task.progress) ? Math.min(100, Math.max(0, task.progress)) : 100)
    : 0;
  const keepMessage = shouldKeepOutput ? task.message : undefined;
  return {
    taskId: task.taskId,
    nodeId: task.nodeId,
    stage: taskStage,
    status: nextStatus,
    index: task.index,
    progress: resolvedProgress,
    display: shouldKeepOutput ? task.display : undefined,
    message: keepMessage,
    inputData: task.inputData,
    outputData: shouldKeepOutput ? task.outputData : undefined,
    errorMessage: undefined,
  };
};

const BUILD_TASK_SEED_BATCH_SIZE = 250;

const seedTaskQueueFromBuildTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  let scannedCount = 0;
  let queuedCount = 0;
  let skippedCount = 0;
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
      if (!resolveBuildTaskStage(task) || !isValidTaskStatus(task.status)) {
        skippedCount += 1;
        return;
      }
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
    skippedCount,
  }));
};

const purgeLegacyBuildTasks = async (nodeId: NodeId): Promise<number> => {
  const invalidTaskIds: string[] = [];
  await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).each((task) => {
    if (!isValidTaskStatus(task.status) || !resolveBuildTaskStage(task)) {
      invalidTaskIds.push(task.taskId);
    }
  });
  if (invalidTaskIds.length === 0) return 0;
  await ephemeralDB.buildTasks.bulkDelete(invalidTaskIds);
  console.warn('[shapeBuildAPI] purged legacy build tasks', JSON.stringify({
    nodeId,
    removedCount: invalidTaskIds.length,
  }));
  return invalidTaskIds.length;
};

const purgeLegacyTaskQueue = async (nodeId: NodeId, taskQueue: VtTaskQueueDb): Promise<number> => {
  const removedTaskIds: string[] = [];
  const tasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
  tasks.forEach((task) => {
    if (!isValidTaskStatus(task.status) || !isValidTaskStage(task.stage)) {
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
  message?: string;
  title?: string;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
} => ({
  message: task.message ?? task.errorMessage,
  title: buildShapeTaskTitle(task),
  error: task.errorMessage,
  errorMessage: task.errorMessage,
  index: task.index,
  stagePriority: task.stagePriority,
  metadata: task.metadata,
});

const mapTaskQueueRecordToTaskSummary = (
  task: TaskQueueRecord,
): ShapeBuildTaskSummary => {
  const base = buildTaskSummaryFields(task);
  return {
    taskId: task.taskId,
    stage: task.stage,
    status: normalizeTaskPhase(resolveEffectiveTaskStatus(task)),
    progress: resolveTaskProgress(task),
    display: task.display,
    message: base.message,
    title: base.title,
    error: base.error,
    errorMessage: base.errorMessage,
    index: base.index,
    stagePriority: base.stagePriority,
    metadata: base.metadata,
  };
};

type ShapeBuildTaskSummary = BuildTaskSummary & {
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
  const stageOrder: Array<TaskQueueRecord['stage']> = ['fetch', 'transform', 'vt'];
  return stageOrder.find((stage) => (
    tasks.some((task) => {
      const status = resolveEffectiveTaskStatus(task);
      return task.stage === stage && status !== 'completed' && status !== 'failed' && status !== 'recycled';
    })
  ));
};

const summarizeTaskQueueStatus = (tasks: TaskQueueRecord[]) => {
  const nonRecycled = tasks.filter((task) => resolveEffectiveTaskStatus(task) !== 'recycled');
  const total = nonRecycled.length;
  const completed = nonRecycled.filter((task) => {
    const status = resolveEffectiveTaskStatus(task);
    return status === 'completed' && !isTaskSkipped(task.display, task.message);
  }).length;
  const failed = nonRecycled.filter((task) => resolveEffectiveTaskStatus(task) === 'failed').length;
  const skipped = nonRecycled.filter((task) => isTaskSkipped(task.display, task.message)).length;
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
    taskType: resolveTaskType(tasks),
  };
};

const summarizeTaskQueueProgress = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
  taskType?: TaskQueueRecord['stage'],
): Promise<ProgressInfo> => {
  const stageCounts: Record<TaskQueueRecord['stage'], {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    recycled: number;
  }> = {
    fetch: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    transform: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
    vt: { total: 0, completed: 0, failed: 0, skipped: 0, recycled: 0 },
  };
  tasks.forEach((task) => {
    const bucket = stageCounts[task.stage];
    const status = resolveEffectiveTaskStatus(task);
    if (status === 'recycled') {
      bucket.recycled += 1;
      return;
    }
    bucket.total += 1;
    if (isTaskSkipped(task.display, task.message)) {
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
  const completed = stageCounts.fetch.completed + stageCounts.transform.completed + stageCounts.vt.completed;
  const failed = stageCounts.fetch.failed + stageCounts.transform.failed + stageCounts.vt.failed;
  const skipped = stageCounts.fetch.skipped + stageCounts.transform.skipped + stageCounts.vt.skipped;
  const plan = getStagePlan(nodeId);
  const resolveStageTotal = (
    counts: typeof stageCounts[keyof typeof stageCounts],
    planned?: number,
  ): number => {
    if (typeof planned !== 'number') return counts.total;
    const adjustedPlan = Math.max(0, planned - counts.recycled);
    return Math.max(counts.total, adjustedPlan);
  };
  const total = resolveStageTotal(stageCounts.fetch, plan?.fetchTotal)
    + resolveStageTotal(stageCounts.transform, plan?.transformTotal)
    + resolveStageTotal(stageCounts.vt);
  let resolvedTaskType = taskType;
  if (!resolvedTaskType && tasks.length === 0 && plan?.fetchTotal && plan.fetchTotal > 0) {
    resolvedTaskType = 'fetch';
  }
  if (!resolvedTaskType && tasks.length === 0 && plan?.transformTotal && plan.transformTotal > 0) {
    resolvedTaskType = 'transform';
  }
  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType: resolvedTaskType,
  };
};

const buildTaskQueueSummary = async (nodeId: NodeId, tasks: TaskQueueRecord[]) => {
  const statusSummary = summarizeTaskQueueStatus(tasks);
  const progress = await summarizeTaskQueueProgress(nodeId, tasks, statusSummary.taskType);
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
    fetch: {
      total: stageStatusMap.fetch.tasksTotal,
      completed: stageStatusMap.fetch.tasksCompleted,
      failed: stageStatusMap.fetch.tasksFailed,
    },
    transform: {
      total: stageStatusMap.transform.tasksTotal,
      completed: stageStatusMap.transform.tasksCompleted,
      failed: stageStatusMap.transform.tasksFailed,
    },
    vt: {
      total: stageStatusMap.vt.tasksTotal,
      completed: stageStatusMap.vt.tasksCompleted,
      failed: stageStatusMap.vt.tasksFailed,
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

const isTaskStageValue = (value: unknown): value is TaskQueueRecord['stage'] => (
  value === 'fetch' || value === 'transform' || value === 'vt'
);

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
      if (isTaskSkipped(task.display, task.message)) {
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
  return {
    fetch: buildStageStatus(tasks.filter((task) => task.stage === 'fetch'), plan?.fetchTotal),
    transform: buildStageStatus(tasks.filter((task) => task.stage === 'transform'), plan?.transformTotal),
    vt: buildStageStatus(tasks.filter((task) => task.stage === 'vt')),
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
    inactiveMs: existing?.inactiveMs,
    lastHeartbeatAt: existing?.lastHeartbeatAt,
    stageInactiveMs: existing?.stageInactiveMs,
    stageStartedAt: existing?.stageStartedAt,
    stageHeartbeatAt: existing?.stageHeartbeatAt,
    stageId: existing?.stageId,
  };
  await shapeMutationAPIImpl.upsertBuildSession(record);
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
  const unsubscribe = onTaskQueueUpdate(nodeId, () => {
    scheduleBuildSessionUpdate(nodeId);
  });
  sessionSubscriptions.set(key, unsubscribe);
};

const stopSessionTracking = (nodeId: NodeId): void => {
  const key = String(nodeId);
  const unsubscribe = sessionSubscriptions.get(key);
  if (unsubscribe) {
    unsubscribe();
  }
  sessionSubscriptions.delete(key);
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
  stopSessionTracking(nodeId);
};

const clearStalePipelineStateIfInactive = async (
  nodeId: NodeId,
  sessionRecord: ShapeBuildSessionRecord | null,
  source: 'startBuildSession' | 'resumeBuildSession',
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
    pending.forEach((resolve) => {resolve()});
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
      stage: statusSummary.taskType ?? 'fetch',
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
  seedTaskQueueFromBuildTasks,
  isTaskStageValue,
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
  upsertBuildSessionSnapshot,
  updateBuildSessionFromTasks,
  resolveTaskActivityTimestamp,
  buildBuildSessionConfig,
} as const;

export type ShapeBuildRuntimeExecutionMetrics = typeof shapeBuildRuntimeExecutionMetrics;
