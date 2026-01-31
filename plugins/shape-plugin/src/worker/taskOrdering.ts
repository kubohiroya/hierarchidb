import type { TaskQueueRecord } from '@hierarchidb/batch-api';

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const resolveTaskSequence = (task: TaskQueueRecord): number => (
  isFiniteNumber(task.sequence) ? task.sequence : -1
);

export const resolveTaskActivityTimestamp = (task: TaskQueueRecord): number => {
  const candidate = task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
  return isFiniteNumber(candidate) ? candidate : 0;
};

export const resolveTaskProcessingTimestamp = (task: TaskQueueRecord): number => {
  const candidate = task.completedAt ?? task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
  return isFiniteNumber(candidate) ? candidate : 0;
};

export const selectLatestTaskBySequence = (tasks: TaskQueueRecord[]): TaskQueueRecord | null => {
  if (tasks.length === 0) return null;
  return tasks.reduce<TaskQueueRecord | null>((latest, task) => {
    if (!latest) return task;
    const latestSeq = resolveTaskSequence(latest);
    const nextSeq = resolveTaskSequence(task);
    if (nextSeq > latestSeq) return task;
    if (nextSeq < latestSeq) return latest;
    const latestTime = resolveTaskActivityTimestamp(latest);
    const nextTime = resolveTaskActivityTimestamp(task);
    return nextTime > latestTime ? task : latest;
  }, null);
};
