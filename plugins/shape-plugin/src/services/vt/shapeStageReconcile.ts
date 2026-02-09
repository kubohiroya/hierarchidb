import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import { reconcileByMetadata, type MetadataDescriptor } from '@hierarchidb/batch';
import { buildStableSignature } from './taskSignatures.ts';

type TaskLike = TaskQueueRecord<unknown, unknown>;

type ReconcileResult<TInput, TOutput> = {
  missingTasks: Array<TaskQueueRecord<TInput, TOutput>>;
  obsoleteTaskIds: string[];
};

const buildDescriptor = (task: TaskLike): MetadataDescriptor => {
  const meta = task.inputData ? buildStableSignature(task.inputData) : undefined;
  return {
    key: task.taskId,
    meta,
    updatedAt: task.updatedAt,
  };
};

export const reconcileStageTasksByMetadata = <TInput, TOutput>(
  desiredTasks: Array<TaskQueueRecord<TInput, TOutput>>,
  existingTasks: Array<TaskQueueRecord<TInput, TOutput>>,
): ReconcileResult<TInput, TOutput> => {
  const sources = desiredTasks.map((task) => buildDescriptor(task as TaskLike));
  const artifacts = existingTasks.map((task) => buildDescriptor(task as TaskLike));
  const diff = reconcileByMetadata(sources, artifacts);
  const createSet = new Set(diff.create);
  const updateSet = new Set(diff.update);
  const removeSet = new Set(diff.remove);

  const missingTasks = desiredTasks.filter(
    (task) => createSet.has(task.taskId) || updateSet.has(task.taskId),
  );
  const obsoleteTaskIds = existingTasks
    .filter((task) => removeSet.has(task.taskId) || updateSet.has(task.taskId))
    .map((task) => task.taskId)
    .sort();

  return { missingTasks, obsoleteTaskIds };
};
