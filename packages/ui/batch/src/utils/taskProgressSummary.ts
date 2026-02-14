export type TaskCountSummary = {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
};

export type TaskLike = {
  status?: string | null;
  message?: string | null;
};

export type TaskStageCarrier = TaskLike & {
  taskType?: string;
  type?: string;
  stage?: string;
};

type TaskCountSummaryOptions<T> = {
  isExcluded?: (task: T) => boolean;
};

export const isFailureStatus = (status?: string | null): boolean => (
  status === 'failed'
);

export const buildTaskCountSummary = <T extends TaskLike>(
  tasks: T[],
  isSkipped: (task: T) => boolean,
  options?: TaskCountSummaryOptions<T>,
): TaskCountSummary => {
  const counts: TaskCountSummary = { total: 0, completed: 0, failed: 0, skipped: 0 };
  tasks.forEach((task) => {
    if (options?.isExcluded?.(task)) {
      return;
    }
    counts.total += 1;
    if (isSkipped(task)) {
      counts.skipped += 1;
      return;
    }
    if (isFailureStatus(task.status)) {
      counts.failed += 1;
      return;
    }
    if (task.status === 'completed') {
      counts.completed += 1;
    }
  });
  return counts;
};

export const buildStageTaskSummary = <T extends TaskStageCarrier>(
  tasks: T[],
  getStageKey: (task: T) => string,
  isSkipped: (task: T) => boolean,
  options?: TaskCountSummaryOptions<T>,
): Record<string, TaskCountSummary> => {
  const summary: Record<string, TaskCountSummary> = {};
  tasks.forEach((task) => {
    if (options?.isExcluded?.(task)) {
      return;
    }
    const stageKey = getStageKey(task);
    if (!summary[stageKey]) {
      summary[stageKey] = { total: 0, completed: 0, failed: 0, skipped: 0 };
    }
    const bucket = summary[stageKey];
    bucket.total += 1;
    if (isSkipped(task)) {
      bucket.skipped += 1;
      return;
    }
    if (isFailureStatus(task.status)) {
      bucket.failed += 1;
      return;
    }
    if (task.status === 'completed') {
      bucket.completed += 1;
    }
  });
  return summary;
};

export const computePercentage = (counts: TaskCountSummary): number => {
  const done = counts.completed + counts.failed + counts.skipped;
  return counts.total > 0 ? Math.round((done / counts.total) * 100) : 0;
};

export const formatPercentageLabel = (counts: TaskCountSummary): string => (
  `${computePercentage(counts)}%`
);
