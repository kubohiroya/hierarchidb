/**
 * Task Queue Management
 *
 * Handles task queue operations, seeding, and status management
 */

import type { TaskDisplayPayload, TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { type EphemeralBuildTaskRecord, ephemeralDB } from '@hierarchidb/gis-sdk';
import type { ShapeBuildStopReason, ShapeBuildTaskRecord } from '@hierarchidb/shape-api';
import { deleteTasksByIds, putTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { Dexie } from 'dexie';

type BuildTaskRecordLike = ShapeBuildTaskRecord | EphemeralBuildTaskRecord;

export type TaskQueueStatusCounts = {
  total: number;
  running: number;
  completed: number;
  failed: number;
  recycled: number;
};

export type CanonicalStageId = 'source-stage' | 'geometry-stage' | 'tile-emit-stage';

export const toCanonicalStageId = (stage: TaskQueueRecord['stage']): CanonicalStageId => {
  if (stage === 'source') return 'source-stage';
  if (stage === 'geometry') return 'geometry-stage';
  return 'tile-emit-stage';
};

export const isSourceStage = (stage: TaskQueueRecord['stage']): boolean =>
  toCanonicalStageId(stage) === 'source-stage';

export const isGeometryStage = (stage: TaskQueueRecord['stage']): boolean =>
  toCanonicalStageId(stage) === 'geometry-stage';

export const isTileEmitStage = (stage: TaskQueueRecord['stage']): boolean =>
  toCanonicalStageId(stage) === 'tile-emit-stage';

export const countTaskQueueStatuses = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId
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

export const resolveEffectiveTaskStatus = (task: TaskQueueRecord): TaskQueueRecord['status'] => {
  if (!isTileEmitStage(task.stage)) return task.status;
  if (task.status !== 'completed') return task.status;
  const progress = typeof task.progress === 'number' ? task.progress : 0;
  const isFinal = typeof task.completedAt === 'number' || progress >= 100;
  return isFinal ? task.status : 'running';
};

export const resolveTaskProgress = (task: TaskQueueRecord): number => {
  return task.progress ?? 0;
};

const readTaskVersionStrict = (task: BuildTaskRecordLike): number => {
  const version = (task as { version?: unknown }).version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    throw new Error(
      `[taskQueueManagement] invalid task version: ${String(version)} (taskId=${task.taskId})`
    );
  }
  return Math.floor(version);
};

const readTaskDisplay = (task: BuildTaskRecordLike): TaskDisplayPayload | undefined => {
  const display = (task as { display?: unknown }).display;
  if (!display || typeof display !== 'object') return undefined;
  return display as TaskDisplayPayload;
};

const resolveBuildTaskMetadata = (
  task: BuildTaskRecordLike
): Record<string, unknown> | undefined => {
  if ('metadata' in task && typeof task.metadata === 'object' && task.metadata !== null) {
    return task.metadata;
  }
  return undefined;
};

const toTaskQueueStatusFromStore = (
  status: BuildTaskRecordLike['status']
): TaskQueueRecord['status'] => {
  if (status === 'failed' || status === 'running') {
    return 'queued';
  }
  return status;
};

export const isStopReason = (value: string): value is ShapeBuildStopReason =>
  value === 'route-leave' ||
  value === 'user-pause' ||
  value === 'failed' ||
  value === 'completed' ||
  value === 'unknown';

const mapBuildTaskToQueueTask = (task: BuildTaskRecordLike): TaskQueueRecord => {
  const nextStatus = toTaskQueueStatusFromStore(task.status);
  const shouldKeepOutput = nextStatus === 'completed' || nextStatus === 'recycled';
  const keepMessage = shouldKeepOutput ? task.errorMessage : undefined;
  const resolvedProgress = shouldKeepOutput
    ? Number.isFinite(task.progress)
      ? Math.min(100, Math.max(0, task.progress))
      : 100
    : 0;
  return {
    taskId: task.taskId,
    version: readTaskVersionStrict(task),
    nodeId: task.nodeId,
    stage: task.stage,
    status: nextStatus,
    index: task.index,
    progress: resolvedProgress,
    display: shouldKeepOutput ? readTaskDisplay(task) : undefined,
    message: keepMessage,
    inputData: task.inputData,
    outputData: shouldKeepOutput ? task.outputData : undefined,
    errorMessage: undefined,
    metadata: resolveBuildTaskMetadata(task),
  };
};

const BUILD_TASK_SEED_BATCH_SIZE = 250;

export const seedTaskQueueFromBuildTasks = async (nodeId: NodeId): Promise<void> => {
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

  console.warn(
    '[taskQueueManagement] seed task queue from build tasks',
    JSON.stringify({
      nodeId,
      scannedCount,
      queuedCount,
    })
  );
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
  console.warn(
    '[taskQueueManagement] purged legacy task queue records',
    JSON.stringify({
      nodeId,
      removedCount: removedTaskIds.length,
    })
  );
  return removedTaskIds.length;
};

export const ensureTaskQueueSeeded = async (
  nodeId: NodeId,
  taskQueue: VtTaskQueueDb
): Promise<void> => {
  await purgeLegacyTaskQueue(nodeId, taskQueue);
  await purgeLegacyBuildTasks(nodeId);
  const existingCount = await taskQueue.tasks.where('nodeId').equals(nodeId).count();
  if (existingCount > 0) return;
  const buildTaskCount = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).count();
  if (buildTaskCount === 0) return;
  await seedTaskQueueFromBuildTasks(nodeId);
};
