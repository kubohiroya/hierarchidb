export type TaskProgressVisibilityFilter = {
  skippedMode: boolean;
  failedMode: boolean;
  completedMode: boolean;
};

export const isTaskProgressFilterActive = (filter: TaskProgressVisibilityFilter): boolean =>
  filter.skippedMode || filter.failedMode || filter.completedMode;

export const isTaskVisibleForProgressFilter = (params: {
  statusValue: string;
  isSkipped: boolean;
  filter: TaskProgressVisibilityFilter;
}): boolean => {
  const { statusValue, isSkipped, filter } = params;

  if (!isTaskProgressFilterActive(filter)) return true;
  if (isSkipped) return filter.skippedMode;
  if (statusValue === 'failed') return filter.failedMode;
  if (statusValue === 'completed' || statusValue === 'recycled') return filter.completedMode;

  return false;
};
