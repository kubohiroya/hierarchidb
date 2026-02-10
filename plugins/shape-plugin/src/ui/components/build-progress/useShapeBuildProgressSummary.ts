import { useEffect, useMemo, useRef } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import {
  buildStageTaskSummary,
  buildTaskCountSummary,
  computePercentage,
  useBuildTaskProgress,
  type TaskCountSummary,
  type TaskStageCarrier,
} from '@hierarchidb/ui-batch-progress';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { BuildProgress, BuildProgressStatus } from './shapeBuildProgressMapping.ts';
import type { BuildTaskSummary } from '@hierarchidb/batch-api';

type CountsWithPercentage = TaskCountSummary & { percentage: number };

type Args<T extends BuildTaskSummary & TaskStageCarrier> = {
  stages: BuildStage[];
  resolvedTaskType?: string;
  overallProgress: number;
  buildStatus: BuildStatus;
  effectiveProgress: BuildProgress | null;
  effectiveStatus: BuildProgressStatus | null;
  taskType?: string;
  tasks: T[];
  normalizeStageKey: (task: T) => TaskStage;
  isSkippedTask: (task: T) => boolean;
  timingStageMs: number;
};

type SummaryResult<T extends BuildTaskSummary & TaskStageCarrier> = {
  taskSummary: Record<string, TaskCountSummary>;
  aggregatedCounts: TaskCountSummary;
  stageProgress: Record<string, number>;
  tasksByStage: Record<string, T[]>;
  paneProgress: Array<{
    paneId: string;
    progress: number;
    taskCount: number;
    completedCount: number;
    status: BuildStatus;
    summary: { total: number; success: number; error: number; skip: number };
  }>;
  displayStageId?: string;
  displayCounts: CountsWithPercentage;
  rawDisplayCounts: CountsWithPercentage;
  hasProgressData: boolean;
  stageRemainingMs: number | null;
};

const MIN_REMAINING_ESTIMATE_ELAPSED_MS = 10_000;
const MIN_REMAINING_ESTIMATE_DONE_TASKS = 10;

export const useShapeBuildProgressSummary = <T extends BuildTaskSummary & TaskStageCarrier>({
  stages,
  resolvedTaskType,
  overallProgress,
  buildStatus,
  effectiveProgress,
  effectiveStatus,
  taskType,
  tasks,
  normalizeStageKey,
  isSkippedTask,
  timingStageMs,
}: Args<T>): SummaryResult<T> => {
  const taskSummary = useMemo(() => (
    buildStageTaskSummary(tasks, normalizeStageKey, isSkippedTask)
  ), [tasks, normalizeStageKey, isSkippedTask]);

  const aggregatedCounts = useMemo(() => (
    buildTaskCountSummary(tasks, isSkippedTask)
  ), [tasks, isSkippedTask]);

  const hasProgressData = Boolean(effectiveProgress)
    || Boolean(effectiveStatus && effectiveStatus.status !== 'idle')
    || tasks.length > 0;

  const { stageProgress, tasksByStage, paneProgress } = useBuildTaskProgress(
    stages,
    resolvedTaskType,
    overallProgress,
    buildStatus,
    tasks,
  );

  const stageTaskCounts = useMemo(() => {
    return stages.reduce<Record<string, { counts: TaskCountSummary; hasIncomplete: boolean }>>((acc, stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.length === 0) {
        acc[stage.id] = {
          counts: { total: 0, completed: 0, failed: 0, skipped: 0 },
          hasIncomplete: false,
        };
        return acc;
      }
      const counts = buildTaskCountSummary(stageTasks, isSkippedTask);
      const done = counts.completed + counts.failed + counts.skipped;
      acc[stage.id] = {
        counts,
        hasIncomplete: done < counts.total,
      };
      return acc;
    }, {});
  }, [isSkippedTask, stages, tasksByStage]);

  const paneProgressWithSummary = useMemo(() => {
    const failureStageId = buildStatus === 'failed'
      ? taskType
      : undefined;
    return stages.map((stage) => {
      const base = paneProgress?.find((entry) => entry.paneId === stage.id);
      const inlineSummary = taskSummary[stage.id];
      const resolvedSummary = inlineSummary
        ? {
          total: inlineSummary.total,
          success: inlineSummary.completed,
          error: inlineSummary.failed,
          skip: inlineSummary.skipped,
        }
        : null;
      const hasSummaryData = Boolean(
        resolvedSummary
        && ((resolvedSummary.total ?? 0) > 0
          || (resolvedSummary.success ?? 0) > 0
          || (resolvedSummary.error ?? 0) > 0
          || (resolvedSummary.skip ?? 0) > 0),
      );
      let total = hasSummaryData
        ? (resolvedSummary?.total ?? 0)
        : (base?.taskCount ?? 0);
      const success = hasSummaryData
        ? (resolvedSummary?.success ?? 0)
        : (base?.completedCount ?? 0);
      let error = hasSummaryData
        ? (resolvedSummary?.error ?? 0)
        : 0;
      const skip = hasSummaryData
        ? (resolvedSummary?.skip ?? 0)
        : 0;
      if (failureStageId && stage.id === failureStageId) {
        error = Math.max(error, 1);
        total = Math.max(total, error + success + skip);
      }
      const done = Math.min(total, success + error + skip);
      const progressValue = total > 0
        ? Math.round((done / total) * 100)
        : (base?.progress ?? 0);
      const status = error > 0
        ? 'failed'
        : total > 0 && success + skip >= total
          ? 'completed'
          : total > 0
            ? 'running'
            : (base?.status ?? buildStatus);
      return {
        paneId: stage.id,
        progress: progressValue,
        taskCount: total,
        completedCount: success,
        status,
        summary: { total, success, error, skip },
      };
    });
  }, [buildStatus, paneProgress, stages, taskSummary, taskType]);

  const lastUnfinishedStageId = useMemo(() => {
    if (buildStatus !== 'running') return undefined;
    let candidate: string | undefined;
    stages.forEach((stage) => {
      const stageInfo = stageTaskCounts[stage.id];
      if (!stageInfo || stageInfo.counts.total === 0) return;
      const hasIncomplete = stageInfo.hasIncomplete;
      if (hasIncomplete) {
        candidate = stage.id;
      }
    });
    return candidate;
  }, [buildStatus, stageTaskCounts, stages]);

  const displayStageId = lastUnfinishedStageId ?? resolvedTaskType;

  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageInfo = stageTaskCounts[lastUnfinishedStageId];
    if (!stageInfo || stageInfo.counts.total === 0) return null;
    return stageInfo.counts;
  }, [lastUnfinishedStageId, stageTaskCounts]);

  const rawDisplayCounts = useMemo<CountsWithPercentage>(() => {
    if (tasks.length > 0 && effectiveProgress && effectiveProgress.total > 0) {
      return {
        total: effectiveProgress.total,
        completed: effectiveProgress.completed,
        failed: effectiveProgress.failed,
        skipped: effectiveProgress.skipped,
        percentage: computePercentage({
          total: effectiveProgress.total,
          completed: effectiveProgress.completed,
          failed: effectiveProgress.failed,
          skipped: effectiveProgress.skipped,
        }),
      };
    }
    if (buildStatus === 'running' && aggregatedCounts.total === 0 && derivedCounts?.total) {
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
      percentage: Math.round(overallProgress),
    };
  }, [aggregatedCounts, buildStatus, derivedCounts, effectiveProgress, overallProgress, tasks.length]);

  const lastStableCountsRef = useRef<CountsWithPercentage | null>(null);
  useEffect(() => {
    if (rawDisplayCounts.total > 0) {
      lastStableCountsRef.current = rawDisplayCounts;
    }
  }, [rawDisplayCounts]);

  const displayCounts = useMemo(() => {
    if (buildStatus === 'running' && rawDisplayCounts.total === 0 && hasProgressData && tasks.length > 0) {
      return lastStableCountsRef.current ?? rawDisplayCounts;
    }
    return rawDisplayCounts;
  }, [buildStatus, hasProgressData, rawDisplayCounts, tasks.length]);

  const combinedStagePercentage = useMemo(() => {
    if (!stages.length) return rawDisplayCounts.percentage;
    const total = stages.reduce((sum, stage) => {
      const value = stageProgress[stage.id] ?? 0;
      return sum + Math.min(100, Math.max(0, value));
    }, 0);
    return Math.min(100, Math.max(0, Math.round(total / stages.length)));
  }, [rawDisplayCounts.percentage, stageProgress, stages]);

  const displayCountsWithStageProgress = useMemo(() => {
    if (buildStatus !== 'running' || !hasProgressData || displayCounts.total <= 0) return displayCounts;
    return { ...displayCounts, percentage: combinedStagePercentage };
  }, [buildStatus, combinedStagePercentage, displayCounts, hasProgressData]);

  const lastDisplayedPercentageRef = useRef<number | null>(null);
  useEffect(() => {
    if (buildStatus !== 'running' || !hasProgressData || displayCounts.total <= 0) {
      lastDisplayedPercentageRef.current = null;
    }
  }, [buildStatus, displayCounts.total, hasProgressData]);

  const displayCountsMonotonic = useMemo(() => {
    if (buildStatus !== 'running' || !hasProgressData || displayCountsWithStageProgress.total <= 0) {
      return displayCountsWithStageProgress;
    }
    const current = displayCountsWithStageProgress.percentage;
    const previous = lastDisplayedPercentageRef.current;
    const next = previous === null ? current : Math.max(previous, current);
    lastDisplayedPercentageRef.current = next;
    return { ...displayCountsWithStageProgress, percentage: next };
  }, [buildStatus, displayCountsWithStageProgress, hasProgressData]);

  const stageRemainingMs = useMemo(() => {
    if (!resolvedTaskType) return null;
    const stageInfo = stageTaskCounts[resolvedTaskType];
    if (!stageInfo || stageInfo.counts.total === 0) return null;
    const counts = stageInfo.counts;
    const done = counts.completed + counts.failed + counts.skipped;
    const remaining = counts.total - done;
    if (remaining <= 0 || done <= 0) return null;
    if (timingStageMs < MIN_REMAINING_ESTIMATE_ELAPSED_MS) return null;
    if (done < MIN_REMAINING_ESTIMATE_DONE_TASKS) return null;
    const avgPerTaskMs = timingStageMs / done;
    if (!Number.isFinite(avgPerTaskMs) || avgPerTaskMs <= 0) return null;
    return Math.max(0, Math.round(avgPerTaskMs * remaining));
  }, [resolvedTaskType, stageTaskCounts, timingStageMs]);

  return {
    taskSummary,
    aggregatedCounts,
    stageProgress,
    tasksByStage,
    paneProgress: paneProgressWithSummary,
    displayStageId,
    displayCounts: displayCountsMonotonic,
    rawDisplayCounts,
    hasProgressData,
    stageRemainingMs,
  };
};
