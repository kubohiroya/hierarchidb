import { useEffect, useMemo, useRef } from 'react';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
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
import type { BatchTaskSummary } from '@hierarchidb/batch-api';

type CountsWithPercentage = TaskCountSummary & { percentage: number };

type Args<T extends BatchTaskSummary & TaskStageCarrier> = {
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

type SummaryResult<T extends BatchTaskSummary & TaskStageCarrier> = {
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

export const useShapeBuildProgressSummary = <T extends BatchTaskSummary & TaskStageCarrier>({
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
      const progressSummary = (!hasSummaryData && stage.id === resolvedTaskType && (effectiveProgress?.total ?? 0) > 0)
        ? {
          total: effectiveProgress?.total ?? 0,
          success: effectiveProgress?.completed ?? 0,
          error: effectiveProgress?.failed ?? 0,
          skip: effectiveProgress?.skipped ?? 0,
          percentage: effectiveProgress?.percentage,
        }
        : null;
      let total = hasSummaryData
        ? (resolvedSummary?.total ?? 0)
        : progressSummary
          ? progressSummary.total
          : (base?.taskCount ?? 0);
      const success = hasSummaryData
        ? (resolvedSummary?.success ?? 0)
        : progressSummary
          ? progressSummary.success
          : (base?.completedCount ?? 0);
      let error = hasSummaryData
        ? (resolvedSummary?.error ?? 0)
        : progressSummary
          ? progressSummary.error
          : 0;
      const skip = hasSummaryData
        ? (resolvedSummary?.skip ?? 0)
        : progressSummary
          ? progressSummary.skip
          : 0;
      if (failureStageId && stage.id === failureStageId) {
        error = Math.max(error, 1);
        total = Math.max(total, error + success + skip);
      }
      const done = Math.min(total, success + error + skip);
      const progressValue = total > 0
        ? Math.round((done / total) * 100)
        : progressSummary?.percentage ?? (base?.progress ?? 0);
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
  }, [buildStatus, effectiveProgress, paneProgress, resolvedTaskType, stages, taskSummary, taskType]);

  const lastUnfinishedStageId = useMemo(() => {
    if (buildStatus !== 'running') return undefined;
    let candidate: string | undefined;
    stages.forEach((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.length === 0) return;
      const hasIncomplete = stageTasks.some((task) => task.status !== 'completed');
      if (hasIncomplete) {
        candidate = stage.id;
      }
    });
    return candidate;
  }, [buildStatus, stages, tasksByStage]);

  const displayStageId = lastUnfinishedStageId ?? resolvedTaskType;

  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageTasks = tasksByStage[lastUnfinishedStageId] ?? [];
    if (!stageTasks.length) return null;
    return buildTaskCountSummary(stageTasks, isSkippedTask);
  }, [lastUnfinishedStageId, tasksByStage, isSkippedTask]);

  const rawDisplayCounts = useMemo<CountsWithPercentage>(() => {
    if (effectiveProgress && effectiveProgress.total > 0) {
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
    if (buildStatus === 'running' && rawDisplayCounts.total === 0 && hasProgressData) {
      return lastStableCountsRef.current ?? rawDisplayCounts;
    }
    return rawDisplayCounts;
  }, [buildStatus, hasProgressData, rawDisplayCounts]);

  const combinedStagePercentage = useMemo(() => {
    if (!stages.length) return rawDisplayCounts.percentage;
    const total = stages.reduce((sum, stage) => {
      const value = stageProgress[stage.id] ?? 0;
      return sum + Math.min(100, Math.max(0, value));
    }, 0);
    return Math.min(100, Math.max(0, Math.round(total / stages.length)));
  }, [rawDisplayCounts.percentage, stageProgress, stages]);

  const displayCountsWithStageProgress = useMemo(() => {
    if (buildStatus !== 'running' || !hasProgressData) return displayCounts;
    return { ...displayCounts, percentage: combinedStagePercentage };
  }, [buildStatus, combinedStagePercentage, displayCounts, hasProgressData]);

  const lastDisplayedPercentageRef = useRef<number | null>(null);
  useEffect(() => {
    if (buildStatus !== 'running' || !hasProgressData) {
      lastDisplayedPercentageRef.current = null;
    }
  }, [buildStatus, hasProgressData]);

  const displayCountsMonotonic = useMemo(() => {
    if (buildStatus !== 'running' || !hasProgressData) return displayCountsWithStageProgress;
    const current = displayCountsWithStageProgress.percentage;
    const previous = lastDisplayedPercentageRef.current;
    const next = previous === null ? current : Math.max(previous, current);
    lastDisplayedPercentageRef.current = next;
    return { ...displayCountsWithStageProgress, percentage: next };
  }, [buildStatus, displayCountsWithStageProgress, hasProgressData]);

  const stageRemainingMs = useMemo(() => {
    if (!resolvedTaskType) return null;
    const stageTasks = tasksByStage[resolvedTaskType] ?? [];
    if (!stageTasks.length) return null;
    const counts = buildTaskCountSummary(stageTasks, isSkippedTask);
    const done = counts.completed + counts.failed + counts.skipped;
    const remaining = counts.total - done;
    if (remaining <= 0 || done <= 0) return null;
    const avgPerTaskMs = timingStageMs / done;
    if (!Number.isFinite(avgPerTaskMs) || avgPerTaskMs <= 0) return null;
    return Math.max(0, Math.round(avgPerTaskMs * remaining));
  }, [isSkippedTask, resolvedTaskType, tasksByStage, timingStageMs]);

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
