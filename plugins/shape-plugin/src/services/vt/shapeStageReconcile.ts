import type { TaskQueueRecord } from '../../../../../packages/build-api';
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
