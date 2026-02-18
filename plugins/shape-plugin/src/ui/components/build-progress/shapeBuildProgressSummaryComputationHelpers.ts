export type { TaskCountSummary } from '@hierarchidb/ui-batch-progress';
export type { BuildStatus } from '@hierarchidb/components/build-status';
export type { StageCountInfo } from './shapeBuildProgressSummaryCountHelpers.ts';
export {
  createStageTaskCounts,
  buildStageCountPlan,
  makeStageTotals,
} from './shapeBuildProgressSummaryCountHelpers.ts';

export {
  chooseInFlightStage,
  makePaneProgress,
} from './shapeBuildProgressSummaryPaneHelpers.ts';

export {
  estimateStageRemainingMs,
  makeRawDisplayCounts,
  resolveFailureStage,
  shouldExposeBuildStatus,
} from './shapeBuildProgressRuntimeHelpers.ts';
export type { CountsWithPercentage } from './shapeBuildProgressRuntimeHelpers.ts';
