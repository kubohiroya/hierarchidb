import { useEffect, useMemo, useRef, useState } from 'react';
import { isTaskSkipped } from '~/common/utils/taskMessageUtils';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { BuildProgress, BuildSessionDisplayStatus } from '~/ui/components/build-progress/shapeBuildProgressTypes';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { useShapeBuildProgressSummaryComputation } from '~/ui/components/build-progress/useShapeBuildProgressSummaryComputation.js';
import {
  buildElapsedByStageWithActiveStage,
  resolveSessionElapsedMs,
  resolveStageElapsedMs,
  resolveTotalElapsedMs,
  shouldResetElapsedState,
} from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/elapsedConstants.js';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
} from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/stage.js';
type StageId = string;

type RuntimeTimingLike = {
  startedAt?: number;
  completedAt?: number;
  heartbeatAt?: number;
  stageId?: string;
  durationMs?: number;
  inactiveMs?: number;
  stageStartedAt?: number;
  stageInactiveMs?: number;
  stageCompletedAt?: number;
};

type SummaryResult = ReturnType<typeof useShapeBuildProgressSummaryComputation<ShapeBuildTaskSummary>>;

type Args = {
  buildStatus: BuildStatus;
  stages: BuildStage[];
  resolvedStage: string | undefined;
  liveStage: string | undefined;
  timingFallbackStage: string | null;
  displayTasks: ShapeBuildTaskSummary[];
  overallProgress: number;
  effectiveProgress: BuildProgress | null;
  effectiveStatus: BuildSessionDisplayStatus | null;
  stageFromState: string | null;
  sessionStageDurationByStageSnapshot: Record<string, number> | null | undefined;
  runtimeTiming: RuntimeTimingLike;
};

export const useShapeBuildSessionProgressState = ({
  buildStatus,
  stages,
  resolvedStage,
  liveStage,
  timingFallbackStage,
  displayTasks,
  overallProgress,
  effectiveProgress,
  effectiveStatus,
  stageFromState,
  sessionStageDurationByStageSnapshot,
  runtimeTiming,
}: Args) => {
  // sessionStageDurationByStageSnapshot is already computed by stageDurationMsByStageAtom
  // (derived directly from stageTimingByStageAtom — no React state duplication needed)
  const sessionStageDurationSnapshot = useMemo<Record<string, number>>(
    () => (sessionStageDurationByStageSnapshot ?? {}),
    [sessionStageDurationByStageSnapshot],
  );
  const sessionStageTimingStageIdSnapshot = useMemo(() => (
    runtimeTiming.stageId ?? null
  ), [runtimeTiming.stageId]);

  const [timingStageId, setTimingStageId] = useState<string | null>(sessionStageTimingStageIdSnapshot);
  const [displayStageRemainingMs, setDisplayStageRemainingMs] = useState<number | null>(null);
  const stageRemainingTickRef = useRef<number | null>(null);
  const latestStageRemainingMsRef = useRef<number | null>(null);
  const isTaskSummaryLoading = false;

  const runningStageIdFromTasks = useMemo(() => resolveMostAdvancedRunningStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);
  const inFlightStageIdFromTasks = useMemo(() => resolveMostAdvancedInFlightStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);

  const isElapsedResetState = useMemo(
    () => shouldResetElapsedState({
      buildStatus,
      buildDurationMs: runtimeTiming.durationMs ?? undefined,
      sessionStageDurationByStage: sessionStageDurationSnapshot,
      // No local state to check — atom value is the single source of truth
      localStageDurationByStage: sessionStageDurationSnapshot,
    }),
    [
      buildStatus,
      runtimeTiming.durationMs,
      sessionStageDurationSnapshot,
    ],
  );

  useEffect(() => {
    if (buildStatus === 'idle' || isElapsedResetState) {
      if (timingStageId !== null) {
        setTimingStageId(null);
      }
      return;
    }

    const fallbackStageId = buildStatus === 'running' ? timingFallbackStage : null;
    const nextStageId = runningStageIdFromTasks
      ?? inFlightStageIdFromTasks
      ?? liveStage
      ?? timingStageId
      ?? sessionStageTimingStageIdSnapshot
      ?? fallbackStageId
      ?? null;
    if (nextStageId && nextStageId !== timingStageId) {
      setTimingStageId(nextStageId);
    }
  }, [
    buildStatus,
    isElapsedResetState,
    inFlightStageIdFromTasks,
    liveStage,
    sessionStageTimingStageIdSnapshot,
    runningStageIdFromTasks,
    timingFallbackStage,
    timingStageId,
  ]);

  const resolvedStageFromState = stageFromState ?? resolvedStage ?? stages[0]?.id;

  // Compute active stage elapsed directly from atom-derived snapshot
  const stageElapsedMs = timingStageId ? (sessionStageDurationSnapshot[timingStageId] ?? 0) : 0;
  const resolvedStageElapsedMs = useMemo(() => {
    if (!timingStageId) {
      return 0;
    }
    if (timingStageId !== sessionStageTimingStageIdSnapshot) {
      return stageElapsedMs;
    }
    if (runtimeTiming.stageStartedAt === undefined) {
      throw new Error('[shape elapsed] stageStartedAt is required for the active stage');
    }
    if (runtimeTiming.stageInactiveMs === undefined) {
      throw new Error('[shape elapsed] stageInactiveMs is required for the active stage');
    }
    const stageEndAt = buildStatus === 'running'
      ? Date.now()
      : (runtimeTiming.stageCompletedAt ?? runtimeTiming.heartbeatAt);
    if (stageEndAt === undefined) {
      if (buildStatus === 'paused') {
        return stageElapsedMs;
      }
      throw new Error(`[shape elapsed] stage end timestamp is required for build status ${buildStatus}`);
    }
    const activeStageElapsedMs = resolveStageElapsedMs({
      stageStartedAt: runtimeTiming.stageStartedAt,
      stageInactiveMs: runtimeTiming.stageInactiveMs,
      endAt: stageEndAt,
    });
    return Math.max(stageElapsedMs, activeStageElapsedMs);
  }, [
    buildStatus,
    sessionStageTimingStageIdSnapshot,
    runtimeTiming.heartbeatAt,
    runtimeTiming.stageInactiveMs,
    runtimeTiming.stageCompletedAt,
    runtimeTiming.stageStartedAt,
    stageElapsedMs,
    timingStageId,
  ]);

  const stageElapsedByStage = useMemo<Record<string, number>>(() => (
    buildElapsedByStageWithActiveStage({
      stageDurationByStage: sessionStageDurationSnapshot,
      timingStageId,
      timingStageElapsedMs: resolvedStageElapsedMs,
    })
  ), [sessionStageDurationSnapshot, resolvedStageElapsedMs, timingStageId]);

  const resolvedSessionElapsedMs = useMemo(() => {
    if (buildStatus === 'paused' && runtimeTiming.heartbeatAt === undefined) {
      return Object.values(stageElapsedByStage).reduce((total, elapsedMs) => total + elapsedMs, 0);
    }
    return resolveSessionElapsedMs({
      buildStatus,
      startedAt: runtimeTiming.startedAt,
      completedAt: runtimeTiming.completedAt,
      heartbeatAt: runtimeTiming.heartbeatAt,
      inactiveMs: runtimeTiming.inactiveMs,
      now: Date.now(),
    });
  }, [
    buildStatus,
    runtimeTiming.completedAt,
    runtimeTiming.heartbeatAt,
    runtimeTiming.inactiveMs,
    runtimeTiming.startedAt,
    stageElapsedByStage,
  ]);

  const totalElapsedMs = useMemo(() => resolveTotalElapsedMs({
    buildStatus,
    stageDurationByStage: stageElapsedByStage,
    sessionDurationMs: resolvedSessionElapsedMs,
  }), [buildStatus, resolvedSessionElapsedMs, stageElapsedByStage]);

  useEffect(() => {
    if (!isElapsedResetState) return;
    setDisplayStageRemainingMs(null);
    stageRemainingTickRef.current = null;
    latestStageRemainingMsRef.current = null;
    if (timingStageId !== null) {
      setTimingStageId(null);
    }
  }, [isElapsedResetState, timingStageId]);

  const failedProbeStageId = useMemo<StageId | null>(() => (
    stages[0]?.id ?? null
  ), [stages]);
  const hasFailedSourceTasks = useMemo(() => {
    if (!failedProbeStageId) {
      return false;
    }
    return displayTasks.some((task) => task.status === 'failed' && task.stage === failedProbeStageId);
  }, [displayTasks, failedProbeStageId]);

  const progressSummary: SummaryResult = useShapeBuildProgressSummaryComputation({
    stages,
    resolvedTaskType: timingStageId ?? resolvedStageFromState,
    overallProgress,
    buildStatus,
    effectiveProgress,
    effectiveStatus,
    stage: stageFromState ?? undefined,
    tasks: displayTasks,
    isSkippedTask: (task: ShapeBuildTaskSummary) => isTaskSkipped(task.display, resolveTaskMetadataMessage(task.metadata)),
    timingStageMs: resolvedStageElapsedMs,
  });

  useEffect(() => {
    latestStageRemainingMsRef.current = progressSummary.stageRemainingMs;
    if (buildStatus !== 'running') {
      setDisplayStageRemainingMs(progressSummary.stageRemainingMs);
    }
  }, [buildStatus, progressSummary.stageRemainingMs]);

  useEffect(() => {
    if (stageRemainingTickRef.current !== null) {
      window.clearInterval(stageRemainingTickRef.current);
      stageRemainingTickRef.current = null;
    }
    if (buildStatus !== 'running') {
      return;
    }

    setDisplayStageRemainingMs((prev) => {
      const next = latestStageRemainingMsRef.current;
      return prev === next ? prev : next;
    });
    stageRemainingTickRef.current = window.setInterval(() => {
      setDisplayStageRemainingMs((prev) => {
        const next = latestStageRemainingMsRef.current;
        return prev === next ? prev : next;
      });
    }, 1000);

    return () => {
      if (stageRemainingTickRef.current !== null) {
        window.clearInterval(stageRemainingTickRef.current);
        stageRemainingTickRef.current = null;
      }
    };
  }, [buildStatus]);

  return {
    completedStageElapsedMs: stageElapsedByStage,
    timingStageId,
    stageElapsedMs: resolvedStageElapsedMs,
    totalElapsedMs,
    displayStageRemainingMs,
    progressSummary,
    hasFailedSourceTasks,
    isTaskSummaryLoading,
    runningStageIdFromTasks,
    inFlightStageIdFromTasks,
  };
};
