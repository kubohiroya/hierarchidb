import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  deleteTasksByIds,
  listTasksByStage,
  putTasks,
  type VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import { reconcileByMetadata, type MetadataDescriptor } from '@hierarchidb/build-runtime-services';
import { resolveTaskCacheIdentity } from './shapeTaskCacheIdentity.ts';

type TaskLike = TaskQueueRecord<unknown, unknown>;

type ReconcileResult<TInput, TOutput> = {
  missingTasks: Array<TaskQueueRecord<TInput, TOutput>>;
  obsoleteTaskIds: string[];
};

const buildDescriptor = (task: TaskLike): MetadataDescriptor => {
  const identity = resolveTaskCacheIdentity(task);
  return {
    key: identity.cacheKey,
    meta: identity.inputHash,
    updatedAt: task.updatedAt,
  };
};

export const reconcileStageTasksByMetadata = <TInput, TOutput>(
  desiredTasks: Array<TaskQueueRecord<TInput, TOutput>>,
  existingTasks: Array<TaskQueueRecord<TInput, TOutput>>,
): ReconcileResult<TInput, TOutput> => {
  const sourceEntries = desiredTasks.map((task) => ({
    task,
    descriptor: buildDescriptor(task as TaskLike),
  }));
  const artifactEntries = existingTasks.map((task) => ({
    task,
    descriptor: buildDescriptor(task as TaskLike),
  }));
  const sources = sourceEntries.map((entry) => entry.descriptor);
  const artifacts = artifactEntries.map((entry) => entry.descriptor);
  const diff = reconcileByMetadata(sources, artifacts);
  const createSet = new Set(diff.create);
  const updateSet = new Set(diff.update);
  const removeSet = new Set(diff.remove);

  const missingTasks = sourceEntries
    .filter((entry) => createSet.has(entry.descriptor.key) || updateSet.has(entry.descriptor.key))
    .map((entry) => entry.task);
  const obsoleteTaskIds = artifactEntries
    .filter((entry) => removeSet.has(entry.descriptor.key) || updateSet.has(entry.descriptor.key))
    .map((entry) => entry.task.taskId)
    .sort();

  return { missingTasks, obsoleteTaskIds };
};

export type ApplyStageTaskReconcileParams<TInput, TOutput> = {
  taskQueue: VtTaskQueueDb;
  nodeId: NodeId;
  stage: TaskQueueRecord['stage'];
  desiredTasks: Array<TaskQueueRecord<TInput, TOutput>>;
  resumeExistingTasks: boolean;
  existingTasks?: Array<TaskQueueRecord<TInput, TOutput>>;
};

export type ApplyStageTaskReconcileResult<TInput, TOutput> = {
  existingTasks: Array<TaskQueueRecord<TInput, TOutput>>;
  missingTasks: Array<TaskQueueRecord<TInput, TOutput>>;
  obsoleteTaskIds: string[];
};

export const applyStageTaskReconcile = async <TInput, TOutput>(
  params: ApplyStageTaskReconcileParams<TInput, TOutput>,
): Promise<ApplyStageTaskReconcileResult<TInput, TOutput>> => {
  params.desiredTasks.forEach((task) => {
    buildDescriptor(task as TaskLike);
  });
  if (!params.resumeExistingTasks) {
    if (params.desiredTasks.length > 0) {
      await putTasks(params.taskQueue, params.desiredTasks);
    }
    return {
      existingTasks: [],
      missingTasks: params.desiredTasks,
      obsoleteTaskIds: [],
    };
  }

  const existingTasks = params.existingTasks
    ?? await listTasksByStage(params.taskQueue, params.nodeId, params.stage) as Array<TaskQueueRecord<TInput, TOutput>>;
  if (existingTasks.length === 0) {
    if (params.desiredTasks.length > 0) {
      await putTasks(params.taskQueue, params.desiredTasks);
    }
    return {
      existingTasks: [],
      missingTasks: params.desiredTasks,
      obsoleteTaskIds: [],
    };
  }

  const { missingTasks, obsoleteTaskIds } = reconcileStageTasksByMetadata(params.desiredTasks, existingTasks);
  if (obsoleteTaskIds.length > 0) {
    await deleteTasksByIds(params.taskQueue, obsoleteTaskIds);
  }
  if (missingTasks.length > 0) {
    await putTasks(params.taskQueue, missingTasks);
  }
  const obsoleteSet = new Set(obsoleteTaskIds);
  return {
    existingTasks: existingTasks.filter((task) => !obsoleteSet.has(task.taskId)),
    missingTasks,
    obsoleteTaskIds,
  };
};
