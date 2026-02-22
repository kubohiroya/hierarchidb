import type { TaskQueueRecord } from '../../../../packages/build-api';

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const resolveTaskActivityTimestamp = (task: TaskQueueRecord): number => {
  const candidate = task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
  return isFiniteNumber(candidate) ? candidate : 0;
};

export const resolveTaskProcessingTimestamp = (task: TaskQueueRecord): number => {
  const candidate = task.completedAt ?? task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
  return isFiniteNumber(candidate) ? candidate : 0;
};

export const selectLatestTaskByProgress = (tasks: TaskQueueRecord[]): TaskQueueRecord | null => {
  if (tasks.length === 0) return null;
  return tasks.reduce<TaskQueueRecord | null>((latest, task) => {
    if (!latest) return task;
    const latestProgress = latest.progress;
    const nextProgress = task.progress;
    if (isFiniteNumber(nextProgress) && isFiniteNumber(latestProgress) && nextProgress !== latestProgress) {
      return nextProgress > latestProgress ? task : latest;
    }
    const latestTime = resolveTaskActivityTimestamp(latest);
    const nextTime = resolveTaskActivityTimestamp(task);
    return nextTime > latestTime ? task : latest;
  }, null);
};
