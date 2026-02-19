export {
  areTaskListsEquivalentForView,
  areTasksEquivalentForView,
  shouldPreferNextTask,
  mergeSnapshotWithCurrent,
  isCompletedAtFullProgress,
  resolveTaskStage,
  resolveProgressValue,
  normalizeTask,
} from './useShapeBuildTaskSync.comparison.utils.ts';
export {
  buildVtParentInputSummaryMessage,
  mergeTaskMessage,
  normalizeTaskStatus,
  readVtParentInputSummary,
  parseScopeFromTaskId,
  resolveTaskScope,
  resolveTaskDisplay,
} from './useShapeBuildTaskSync.task-utils.ts';
