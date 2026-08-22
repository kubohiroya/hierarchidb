import type { BuildTaskSummary, TaskStage } from '@hierarchidb/build-api';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import {
  buildStageTaskSummary,
  buildTaskCountSummary,
  type TaskCountSummary,
  type TaskLike,
  useBuildTaskProgress,
} from '@hierarchidb/ui-build-sessions';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  buildStageCountPlan,
  chooseInFlightStage,
  createStageTaskCounts,
  estimateStageRemainingMs,
  makePaneProgress,
  makeRawDisplayCounts,
  makeStageTotals,
} from './shapeBuildProgressSummaryComputationHelpers.js';
import type { BuildProgress, BuildSessionDisplayStatus } from './shapeBuildProgressTypes.js';

type CountsWithPercentage = TaskCountSummary & { percentage: number };

type ShapeTaskStageCarrier = BuildTaskSummary &
  TaskLike & {
    stage: TaskStage;
  };

type ShapeBuildProgressSummaryArgs<T extends ShapeTaskStageCarrier> = {
  stages: BuildStage[];
  resolvedTaskType?: string;
  overallProgress: number;
  buildStatus: BuildStatus;
  effectiveProgress: BuildProgress | null;
  effectiveStatus: BuildSessionDisplayStatus | null;
  stage?: string;
  tasks: T[];
  isSkippedTask: (task: T) => boolean;
  timingStageMs: number;
};

type ShapeBuildProgressSummaryResult<T extends ShapeTaskStageCarrier> = {
  taskSummary: ReturnType<typeof buildStageTaskSummary>;
  aggregatedCounts: ReturnType<typeof buildTaskCountSummary>;
  stageProgress: Record<string, number>;
  stageTotals: Record<string, TaskCountSummary>;
  tasksByStage: Record<string, T[]>;
  paneProgress: Array<{
    paneId: string;
    progress: number;
    taskCount: number;
    completedCount: number;
    status: BuildSessionDisplayStatus['status'];
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

export const useShapeBuildProgressSummaryComputation = <T extends ShapeTaskStageCarrier>({
  stages,
  resolvedTaskType,
  overallProgress,
  buildStatus,
  effectiveProgress,
  effectiveStatus,
  stage,
  tasks,
  isSkippedTask,
  timingStageMs,
}: ShapeBuildProgressSummaryArgs<T>): ShapeBuildProgressSummaryResult<T> => {
  const isRecycledTask = useCallback(
    (task: ShapeTaskStageCarrier): boolean => task.status === 'recycled',
    []
  );
  const normalizedTasks = useMemo<ShapeTaskStageCarrier[]>(
    () => tasks as ShapeTaskStageCarrier[],
    [tasks]
  );
  const isRecycledTaskForBuild = useCallback(
    (task: T): boolean => isRecycledTask(task),
    [isRecycledTask]
  );
  const isSkippedTaskForSummary = useCallback(
    (task: ShapeTaskStageCarrier): boolean => isSkippedTask(task as T),
    [isSkippedTask]
  );

  const taskSummary = useMemo(
    () =>
      buildStageTaskSummary(
        normalizedTasks,
        (task: ShapeTaskStageCarrier) => task.stage,
        isSkippedTaskForSummary,
        { isExcluded: isRecycledTask }
      ),
    [isRecycledTask, isSkippedTaskForSummary, normalizedTasks]
  );

  const aggregatedCounts = useMemo(
    () =>
      buildTaskCountSummary(normalizedTasks, isSkippedTaskForSummary, {
        isExcluded: isRecycledTask,
      }),
    [isRecycledTask, isSkippedTaskForSummary, normalizedTasks]
  );

  const hasProgressData =
    Boolean(effectiveProgress) ||
    Boolean(effectiveStatus && effectiveStatus.status !== 'idle') ||
    tasks.length > 0;
  const hasEffectiveTasks = aggregatedCounts.total > 0;

  const { stageProgress, tasksByStage, paneProgress } = useBuildTaskProgress(
    stages,
    stage,
    overallProgress,
    buildStatus,
    tasks,
    { isExcludedTask: isRecycledTaskForBuild }
  );

  const stageTaskCounts = useMemo(
    () =>
      createStageTaskCounts({
        stages,
        tasksByStage,
        isSkippedTask: isSkippedTaskForSummary,
        isExcludedTask: isRecycledTask,
      }),
    [isRecycledTask, isSkippedTaskForSummary, stages, tasksByStage]
  );

  const stageCountsWithPlan = useMemo(
    () =>
      buildStageCountPlan({
        stages,
        stageTaskCounts,
        buildStatus,
        effectiveProgress,
      }),
    [buildStatus, effectiveProgress, stageTaskCounts, stages]
  );

  const paneProgressWithSummary = useMemo(
    () =>
      makePaneProgress({
        stages,
        paneProgress,
        stageCountsWithPlan,
        buildStatus,
        failureStageId: buildStatus === 'failed' && stage ? stage : undefined,
        hasFailureData: aggregatedCounts.total > 0,
      }),
    [aggregatedCounts, buildStatus, paneProgress, stageCountsWithPlan, stage, stages]
  );

  const stageProgressWithSummary = useMemo(() => {
    const next = {} as Record<string, number>;
    for (const stage of stages) {
      if (buildStatus === 'idle' && aggregatedCounts.total === 0) {
        next[stage.id] = 0;
        continue;
      }
      const pane = paneProgressWithSummary.find((entry) => entry.paneId === stage.id);
      const stageProgressValue = pane?.progress ?? stageProgress[stage.id] ?? 0;
      next[stage.id] = Math.min(100, Math.max(0, stageProgressValue));
    }
    return next;
  }, [aggregatedCounts.total, buildStatus, paneProgressWithSummary, stageProgress, stages]);

  const displayStageId = chooseInFlightStage({
    stages,
    stageCountsWithPlan,
    buildStatus,
    tasksByStage,
    resolvedTaskType,
  });

  const derivedCounts = useMemo(() => {
    if (!displayStageId) return null;
    const countsWithPlan = stageCountsWithPlan[displayStageId];
    if (!countsWithPlan || countsWithPlan.counts.total === 0) return null;
    return countsWithPlan.counts;
  }, [displayStageId, stageCountsWithPlan]);

  const rawDisplayCounts = useMemo<CountsWithPercentage>(
    () =>
      makeRawDisplayCounts({
        effectiveProgress,
        shouldUseRuntimeProgress:
          buildStatus === 'running' || buildStatus === 'paused' || aggregatedCounts.total > 0,
        aggregatedCounts,
        derivedCounts,
        buildStatus,
      }),
    [aggregatedCounts, buildStatus, derivedCounts, effectiveProgress]
  );

  const runningProgress = useMemo(() => {
    if (buildStatus !== 'running' && buildStatus !== 'paused') {
      return rawDisplayCounts;
    }
    if (!stages.length) {
      return rawDisplayCounts;
    }
    const activeStageIds = stages
      .map((stage) => stage.id)
      .filter((id) => tasksByStage[id]?.length)
      .filter((id) => (stageProgressWithSummary[id] ?? 0) > 0 || rawDisplayCounts.total > 0);

    const values = activeStageIds
      .map((id) => Math.min(100, Math.max(0, stageProgressWithSummary[id] ?? 0)))
      .filter((value) => value > 0);

    const valuesToAverage = values.length > 0 ? values : [0];
    const total = valuesToAverage.reduce((sum, value) => sum + value, 0);
    return {
      ...rawDisplayCounts,
      percentage: Math.min(100, Math.max(0, Math.round(total / valuesToAverage.length))),
    };
  }, [buildStatus, rawDisplayCounts, stageProgressWithSummary, stages, tasksByStage]);

  const stableCountsRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      (buildStatus !== 'running' && buildStatus !== 'paused') ||
      !hasProgressData ||
      runningProgress.total <= 0
    ) {
      stableCountsRef.current = null;
      return;
    }
    if (rawDisplayCounts.total > 0) {
      stableCountsRef.current = rawDisplayCounts.total;
    }
  }, [buildStatus, hasProgressData, rawDisplayCounts, runningProgress.total]);

  const displayCounts = useMemo(() => {
    if (
      (buildStatus === 'running' || buildStatus === 'paused') &&
      runningProgress.total === 0 &&
      hasProgressData &&
      hasEffectiveTasks
    ) {
      if (stableCountsRef.current !== null) {
        return {
          ...runningProgress,
          total: rawDisplayCounts.total,
          percentage: runningProgress.percentage,
          completed: rawDisplayCounts.completed,
          failed: rawDisplayCounts.failed,
          skipped: rawDisplayCounts.skipped,
        };
      }
    }
    return runningProgress;
  }, [buildStatus, hasProgressData, hasEffectiveTasks, rawDisplayCounts, runningProgress]);

  const monotonicDisplayCounts = useMemo(() => {
    if (
      (buildStatus !== 'running' && buildStatus !== 'paused') ||
      !hasProgressData ||
      displayCounts.total <= 0
    ) {
      return displayCounts;
    }
    const prev = stableCountsRef.current;
    const next =
      prev === null ? displayCounts.percentage : Math.max(prev, displayCounts.percentage);
    stableCountsRef.current = next;
    return {
      ...displayCounts,
      percentage: next,
    };
  }, [buildStatus, displayCounts, hasProgressData]);

  const stageTotals = useMemo(
    () => makeStageTotals(stages, stageCountsWithPlan),
    [stages, stageCountsWithPlan]
  );

  const stageRemainingMs = useMemo(
    () =>
      estimateStageRemainingMs({
        resolvedTaskType,
        stageCountsWithPlan,
        timingStageMs,
        minElapsedMs: MIN_REMAINING_ESTIMATE_ELAPSED_MS,
        minDoneTasks: MIN_REMAINING_ESTIMATE_DONE_TASKS,
      }),
    [resolvedTaskType, stageCountsWithPlan, timingStageMs]
  );

  return {
    taskSummary,
    aggregatedCounts,
    stageProgress: stageProgressWithSummary,
    stageTotals,
    tasksByStage,
    paneProgress: paneProgressWithSummary,
    displayStageId,
    displayCounts: monotonicDisplayCounts,
    rawDisplayCounts,
    hasProgressData,
    stageRemainingMs,
  };
};
