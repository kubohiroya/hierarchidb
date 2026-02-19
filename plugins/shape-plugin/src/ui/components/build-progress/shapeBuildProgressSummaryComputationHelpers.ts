export type { TaskCountSummary } from '@hierarchidb/ui-batch-progress';
export type { BuildStatus } from '@hierarchidb/components/build-status';
export type { StageCountInfo } from './shapeBuildProgressSummaryCountHelpers.js';
export {
  createStageTaskCounts,
  buildStageCountPlan,
  makeStageTotals,
} from './shapeBuildProgressSummaryCountHelpers.js';

export {
  chooseInFlightStage,
  makePaneProgress,
} from './shapeBuildProgressSummaryPaneHelpers.js';

export {
  estimateStageRemainingMs,
  makeRawDisplayCounts,
  resolveFailureStage,
  shouldExposeBuildStatus,
} from './shapeBuildProgressRuntimeHelpers.js';
export type { CountsWithPercentage } from './shapeBuildProgressRuntimeHelpers.js';
