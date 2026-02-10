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
  stageTotals: Record<string, TaskCountSummary>;
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

  const stageCountsWithPlan = useMemo(() => {
    return stages.reduce<Record<string, { counts: TaskCountSummary; hasIncomplete: boolean }>>((acc, stage) => {
      const stageInfo = stageTaskCounts[stage.id];
      const actualCounts = stageInfo?.counts ?? { total: 0, completed: 0, failed: 0, skipped: 0 };
      const plannedCounts = effectiveProgress?.stageTotals?.[stage.id as 'fetch' | 'transform' | 'vt'];
      const mergedCompleted = Math.max(actualCounts.completed, plannedCounts?.completed ?? 0);
      const mergedFailed = Math.max(actualCounts.failed, plannedCounts?.failed ?? 0);
      const mergedSkipped = Math.max(actualCounts.skipped, plannedCounts?.skipped ?? 0);
      const mergedDone = mergedCompleted + mergedFailed + mergedSkipped;
      const mergedTotal = Math.max(
        actualCounts.total,
        plannedCounts?.total ?? 0,
        mergedDone,
      );
      acc[stage.id] = {
        counts: {
          total: mergedTotal,
          completed: mergedCompleted,
          failed: mergedFailed,
          skipped: mergedSkipped,
        },
        hasIncomplete: mergedDone < mergedTotal,
      };
      return acc;
    }, {});
  }, [effectiveProgress?.stageTotals, stageTaskCounts, stages]);

  const paneProgressWithSummary = useMemo(() => {
    const failureStageId = buildStatus === 'failed'
      ? taskType
      : undefined;
    return stages.map((stage) => {
      const base = paneProgress?.find((entry) => entry.paneId === stage.id);
      const stageCounts = stageCountsWithPlan[stage.id]?.counts
        ?? { total: 0, completed: 0, failed: 0, skipped: 0 };
      const hasSummaryData = stageCounts.total > 0
        || stageCounts.completed > 0
        || stageCounts.failed > 0
        || stageCounts.skipped > 0;
      let total = hasSummaryData
        ? stageCounts.total
        : (base?.taskCount ?? 0);
      const success = hasSummaryData
        ? stageCounts.completed
        : (base?.completedCount ?? 0);
      let error = hasSummaryData
        ? stageCounts.failed
        : 0;
      const skip = hasSummaryData
        ? stageCounts.skipped
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
  }, [buildStatus, paneProgress, stageCountsWithPlan, stages, taskType]);

  const stageProgressWithSummary = useMemo(() => {
    return stages.reduce<Record<string, number>>((acc, stage) => {
      const pane = paneProgressWithSummary.find((entry) => entry.paneId === stage.id);
      acc[stage.id] = Math.min(100, Math.max(0, pane?.progress ?? stageProgress[stage.id] ?? 0));
      return acc;
    }, {});
  }, [paneProgressWithSummary, stageProgress, stages]);

  const lastUnfinishedStageId = useMemo(() => {
    if (buildStatus !== 'running') return undefined;
    let candidate: string | undefined;
    stages.forEach((stage) => {
      const stageInfo = stageCountsWithPlan[stage.id];
      if (!stageInfo || stageInfo.counts.total === 0) return;
      const hasIncomplete = stageInfo.hasIncomplete;
      if (hasIncomplete) {
        candidate = stage.id;
      }
    });
    return candidate;
  }, [buildStatus, stageCountsWithPlan, stages]);

  const displayStageId = lastUnfinishedStageId ?? resolvedTaskType;

  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageInfo = stageCountsWithPlan[lastUnfinishedStageId];
    if (!stageInfo || stageInfo.counts.total === 0) return null;
    return stageInfo.counts;
  }, [lastUnfinishedStageId, stageCountsWithPlan]);

  const rawDisplayCounts = useMemo<CountsWithPercentage>(() => {
    if (effectiveProgress && effectiveProgress.total > 0 && buildStatus !== 'idle') {
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
  }, [aggregatedCounts, buildStatus, derivedCounts, effectiveProgress, overallProgress]);

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
      const value = stageProgressWithSummary[stage.id] ?? 0;
      return sum + Math.min(100, Math.max(0, value));
    }, 0);
    return Math.min(100, Math.max(0, Math.round(total / stages.length)));
  }, [rawDisplayCounts.percentage, stageProgressWithSummary, stages]);

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
    const stageInfo = stageCountsWithPlan[resolvedTaskType];
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
  }, [resolvedTaskType, stageCountsWithPlan, timingStageMs]);

  const stageTotals = useMemo(() => {
    return stages.reduce<Record<string, TaskCountSummary>>((acc, stage) => {
      acc[stage.id] = stageCountsWithPlan[stage.id]?.counts
        ?? { total: 0, completed: 0, failed: 0, skipped: 0 };
      return acc;
    }, {});
  }, [stageCountsWithPlan, stages]);

  return {
    taskSummary,
    aggregatedCounts,
    stageProgress: stageProgressWithSummary,
    stageTotals,
    tasksByStage,
    paneProgress: paneProgressWithSummary,
    displayStageId,
    displayCounts: displayCountsMonotonic,
    rawDisplayCounts,
    hasProgressData,
    stageRemainingMs,
  };
};
