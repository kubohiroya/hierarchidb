export type { TaskCountSummary } from '../../../../../../packages/ui/build-sessions';
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
