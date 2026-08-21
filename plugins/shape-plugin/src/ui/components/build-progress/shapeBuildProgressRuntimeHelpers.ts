import { computePercentage, type TaskCountSummary } from '@hierarchidb/ui-build-sessions';
import type { BuildProgress } from './shapeBuildProgressTypes.js';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { StageCountInfo } from './shapeBuildProgressSummaryCountHelpers.js';

export type CountsWithPercentage = TaskCountSummary & { percentage: number };

export const makeRawDisplayCounts = ({
  effectiveProgress,
  shouldUseRuntimeProgress,
  aggregatedCounts,
  derivedCounts,
  buildStatus,
}: {
  effectiveProgress: BuildProgress | null;
  shouldUseRuntimeProgress: boolean;
  aggregatedCounts: TaskCountSummary;
  derivedCounts: TaskCountSummary | null;
  buildStatus: BuildStatus;
}): CountsWithPercentage => {
  if (effectiveProgress && effectiveProgress.total > 0 && shouldUseRuntimeProgress) {
    return {
      total: effectiveProgress.total,
      completed: effectiveProgress.completed,
      failed: effectiveProgress.failed,
      skipped: effectiveProgress.skipped,
      percentage: computePercentage(effectiveProgress),
    };
  }

  if ((buildStatus === 'running' || buildStatus === 'paused') && aggregatedCounts.total === 0 && derivedCounts) {
    return {
      ...derivedCounts,
      percentage: computePercentage(derivedCounts),
    };
  }

  if (aggregatedCounts.total > 0) {
    return {
      ...aggregatedCounts,
      percentage: computePercentage(aggregatedCounts),
    };
  }

  return {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
  };
};

export const estimateStageRemainingMs = ({
  resolvedTaskType,
  stageCountsWithPlan,
  timingStageMs,
  minElapsedMs = 10_000,
  minDoneTasks = 10,
}: {
  resolvedTaskType?: string;
  stageCountsWithPlan: Record<string, StageCountInfo>;
  timingStageMs: number;
  minElapsedMs?: number;
  minDoneTasks?: number;
}): number | null => {
  if (!resolvedTaskType) {
    return null;
  }
  const stageInfo = stageCountsWithPlan[resolvedTaskType];
  if (!stageInfo || stageInfo.counts.total === 0) {
    return null;
  }

  const done = stageInfo.counts.completed + stageInfo.counts.failed + stageInfo.counts.skipped;
  const remaining = stageInfo.counts.total - done;
  if (remaining <= 0 || done <= 0) {
    return null;
  }
  if (timingStageMs < minElapsedMs || done < minDoneTasks) {
    return null;
  }

  const avgPerTaskMs = timingStageMs / done;
  if (!Number.isFinite(avgPerTaskMs) || avgPerTaskMs <= 0) {
    return null;
  }
  return Math.max(0, Math.round(avgPerTaskMs * remaining));
};

export const resolveFailureStage = ({
  buildStatus,
  stage,
}: {
  buildStatus: BuildStatus;
  stage?: string;
}): { failureStageId?: string; enabled: boolean } => {
  if (buildStatus !== 'failed' || !stage) {
    return { failureStageId: undefined, enabled: false };
  }
  return { failureStageId: stage, enabled: true };
};

export const shouldExposeBuildStatus = ({
  buildStatus,
  hasProgressData,
}: {
  buildStatus: BuildStatus;
  hasProgressData: boolean;
}): boolean => (
  (buildStatus === 'running' || buildStatus === 'paused') && hasProgressData
);
