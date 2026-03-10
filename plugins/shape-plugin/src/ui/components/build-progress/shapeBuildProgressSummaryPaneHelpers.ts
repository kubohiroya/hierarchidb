import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { BuildProgressStatus } from './shapeBuildProgressMapping.js';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { BuildTaskSummary, TaskStage } from '@hierarchidb/build-api';
import { resolveMostAdvancedStageId } from './stagePriority.js';
import type { StageCountInfo } from './shapeBuildProgressSummaryCountHelpers.js';
import { resolveStageAliasArray } from './stageIdAliases';

type TaskStageCarrier = BuildTaskSummary & { stage: TaskStage };

const normalizePaneStatus = (status: BuildStatus | BuildProgressStatus['status']): BuildProgressStatus['status'] => {
  if (status === 'running') {
    return 'processing';
  }
  if (status === 'queued') {
    return 'queued';
  }
  return status;
};

export const makePaneProgress = ({
  stages,
  paneProgress,
  stageCountsWithPlan,
  buildStatus,
  failureStageId,
  hasFailureData,
}: {
  stages: BuildStage[];
  paneProgress: Array<{
    paneId: string;
    progress: number;
    taskCount: number;
    completedCount: number;
    status: BuildStatus;
  }>;
  stageCountsWithPlan: Record<string, StageCountInfo>;
  buildStatus: BuildStatus;
  failureStageId?: string;
  hasFailureData: boolean;
}): Array<{
  paneId: string;
  progress: number;
  taskCount: number;
  completedCount: number;
  status: BuildProgressStatus['status'];
  summary: { total: number; success: number; error: number; skip: number };
}> => stages.map((stage) => {
  const base = paneProgress.find((entry) => entry.paneId === stage.id);
  const stageCounts = stageCountsWithPlan[stage.id]?.counts
    ?? { total: 0, completed: 0, failed: 0, skipped: 0 };

  const hasSummaryData = stageCounts.total > 0 || stageCounts.completed > 0 || stageCounts.failed > 0 || stageCounts.skipped > 0;
  let total = hasSummaryData ? stageCounts.total : (base?.taskCount ?? 0);
  const success = hasSummaryData ? stageCounts.completed : (base?.completedCount ?? 0);
  let error = hasSummaryData ? stageCounts.failed : 0;
  const skip = hasSummaryData ? stageCounts.skipped : 0;
  const completionProgress = total > 0 ? Math.round((success + error + skip) / total * 100) : 0;
  const runtimeProgress = typeof base?.progress === 'number'
    ? Math.min(100, Math.max(0, Math.round(base.progress)))
    : null;
  const shouldUseTaskProgress = (buildStatus === 'running' || buildStatus === 'paused')
    && base !== undefined
    && (base.taskCount ?? 0) > 0;

  const shouldForceFailure = buildStatus === 'failed'
    && failureStageId
    && stage.id === failureStageId
    && (stageCounts.total > 0 || hasFailureData);
  if (shouldForceFailure) {
    error = Math.max(error, 1);
    total = Math.max(total, error + success + skip);
  }

  const baseStatus = base ? normalizePaneStatus(base.status) : undefined;
  const normalizedBuildStatus = normalizePaneStatus(buildStatus);
  const progress = hasSummaryData
    ? shouldUseTaskProgress ? Math.max(completionProgress, runtimeProgress ?? 0) : completionProgress
    : runtimeProgress ?? 0;

  return {
    paneId: stage.id,
    progress,
    taskCount: total,
    completedCount: success,
    status: error > 0
      ? 'failed'
      : total > 0 && success + skip >= total
        ? 'completed'
        : buildStatus === 'paused'
          ? 'paused'
          : total > 0
        ? 'processing'
        : baseStatus ?? normalizedBuildStatus,
    summary: { total, success, error, skip },
  };
});

export const chooseInFlightStage = ({
  stages,
  stageCountsWithPlan,
  buildStatus,
  tasksByStage,
  resolvedTaskType,
}: {
  stages: BuildStage[];
  stageCountsWithPlan: Record<string, StageCountInfo>;
  buildStatus: BuildStatus;
  tasksByStage: Record<string, (BuildTaskSummary & TaskStageCarrier)[]>;
  resolvedTaskType?: string;
}) => {
  if (buildStatus !== 'running' && buildStatus !== 'paused') {
    return undefined;
  }

  let candidate: string | undefined;
  for (const stage of stages) {
    const stageInfo = stageCountsWithPlan[stage.id];
    if (!stageInfo || stageInfo.counts.total === 0) {
      continue;
    }
    if (stageInfo.hasIncomplete) {
      candidate = stage.id;
    }
  }

  const runningStageIds = stages
    .filter((stage) =>
      resolveStageAliasArray(tasksByStage, stage.id).some((task) => task.status === 'running' || task.status === 'queued'),
    )
    .map((stage) => stage.id);

  return resolveMostAdvancedStageId(runningStageIds, stages) ?? candidate ?? resolvedTaskType;
};
