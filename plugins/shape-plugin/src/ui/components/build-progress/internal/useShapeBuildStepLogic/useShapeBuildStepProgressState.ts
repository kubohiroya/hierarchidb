import { useEffect, useMemo, useRef, useState } from 'react';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildProgress, BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { useShapeBuildProgressSummaryComputation } from '~/ui/components/build-progress/useShapeBuildProgressSummaryComputation.js';
import {
  buildElapsedByStageWithActiveStage,
  hasPositiveDuration,
  mergeElapsedByStage,
  resolveTotalElapsedMs,
  shallowEqualNumberRecord,
  shouldResetElapsedState,
} from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/elapsed.js';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
} from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage.js';
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
  effectiveStatus: BuildProgressStatus | null;
  stageFromState: string | null;
  sessionStageDurationByStageSnapshot: Record<string, number> | null | undefined;
  runtimeTiming: RuntimeTimingLike;
  activeNodeId: string | null;
};

export const useShapeBuildStepProgressState = ({
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
  activeNodeId,
}: Args) => {
  const sessionStageDurationSnapshot = useMemo<Record<string, number>>(
    () => (sessionStageDurationByStageSnapshot ?? {}),
    [sessionStageDurationByStageSnapshot],
  );
  const sessionStageTimingStageIdSnapshot = useMemo(() => (
    runtimeTiming.stageId ?? null
  ), [runtimeTiming.stageId]);

  const [completedStageDurationMsByStage, setCompletedStageDurationMsByStage] = useState<Record<string, number>>(
    () => sessionStageDurationSnapshot,
  );
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
      localStageDurationByStage: completedStageDurationMsByStage,
    }),
    [
      buildStatus,
      completedStageDurationMsByStage,
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

  const stageElapsedMs = timingStageId ? (completedStageDurationMsByStage[timingStageId] ?? 0) : 0;
  const resolvedStageElapsedMs = useMemo(() => {
    if (!timingStageId) {
      return 0;
    }
    if (timingStageId !== sessionStageTimingStageIdSnapshot || runtimeTiming.stageStartedAt === undefined) {
      return stageElapsedMs;
    }
    const stageBaseTime = buildStatus === 'running'
      ? Date.now()
      : runtimeTiming.heartbeatAt ?? Date.now();
    const activeStageElapsedMs = Math.max(
      0,
      stageBaseTime - runtimeTiming.stageStartedAt - (runtimeTiming.stageInactiveMs ?? 0),
    );
    return Math.max(stageElapsedMs, activeStageElapsedMs);
  }, [
    buildStatus,
    sessionStageTimingStageIdSnapshot,
    runtimeTiming.heartbeatAt,
    runtimeTiming.stageInactiveMs,
    runtimeTiming.stageStartedAt,
    stageElapsedMs,
    timingStageId,
  ]);

  const stageElapsedByStage = useMemo<Record<string, number>>(() => (
    buildElapsedByStageWithActiveStage({
      stageDurationByStage: completedStageDurationMsByStage,
      timingStageId,
      timingStageElapsedMs: resolvedStageElapsedMs,
    })
  ), [completedStageDurationMsByStage, resolvedStageElapsedMs, timingStageId]);

  const resolvedSessionElapsedMs = useMemo(() => {
    if (typeof runtimeTiming.durationMs === 'number' && runtimeTiming.durationMs > 0) {
      return runtimeTiming.durationMs;
    }
    const startedAt = runtimeTiming.startedAt;
    if (typeof startedAt !== 'number' || Number.isNaN(startedAt) || startedAt <= 0) {
      return 0;
    }
    const inactiveMs = 0;
    const endAt = buildStatus === 'running'
      ? Date.now()
      : (runtimeTiming.heartbeatAt ?? runtimeTiming.completedAt ?? Date.now());
    return Math.max(0, endAt - startedAt - inactiveMs);
  }, [
    buildStatus,
    runtimeTiming.completedAt,
    runtimeTiming.durationMs,
    runtimeTiming.heartbeatAt,
    runtimeTiming.startedAt,
  ]);

  const totalElapsedMs = useMemo(() => resolveTotalElapsedMs({
    buildStatus,
    stageDurationByStage: stageElapsedByStage,
    sessionDurationMs: resolvedSessionElapsedMs,
  }), [buildStatus, resolvedSessionElapsedMs, stageElapsedByStage]);

  useEffect(() => {
    if (isElapsedResetState) {
      setCompletedStageDurationMsByStage((current) => {
        if (shallowEqualNumberRecord(current, {})) return current;
        return {};
      });
      return;
    }
    setCompletedStageDurationMsByStage((current) => {
      const merged = mergeElapsedByStage(current, sessionStageDurationSnapshot);
      if (shallowEqualNumberRecord(current, merged)) return current;
      return merged;
    });
  }, [isElapsedResetState, sessionStageDurationSnapshot]);

  useEffect(() => {
    if (!isElapsedResetState) return;
    setDisplayStageRemainingMs(null);
    stageRemainingTickRef.current = null;
    latestStageRemainingMsRef.current = null;
    if (timingStageId !== null) {
      setTimingStageId(null);
    }
  }, [isElapsedResetState, timingStageId]);

  const isTimingStageRunning = useMemo(() => {
    if (!timingStageId) return false;
    return displayTasks.some((task) => (
      task.stage === timingStageId
      && task.status === 'running'
    ));
  }, [displayTasks, timingStageId]);
  const isTimingStageSessionActive = useMemo(() => (
    timingStageId !== null
    && timingStageId === sessionStageTimingStageIdSnapshot
    && typeof runtimeTiming.stageStartedAt === 'number'
    && runtimeTiming.stageStartedAt > 0
  ), [sessionStageTimingStageIdSnapshot, runtimeTiming.stageStartedAt, timingStageId]);
  const isTimingStageActive = isTimingStageRunning || isTimingStageSessionActive;

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (!timingStageId) return;
    if (!isTimingStageActive) return;
    const intervalId = window.setInterval(() => {
      setCompletedStageDurationMsByStage((current) => {
        const nextValue = (current[timingStageId] ?? 0) + 1000;
        if (current[timingStageId] === nextValue) return current;
        return {
          ...current,
          [timingStageId]: nextValue,
        };
      });
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [buildStatus, isTimingStageActive, timingStageId]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (hasPositiveDuration(sessionStageDurationSnapshot)) return;
    if (typeof runtimeTiming.durationMs === 'number' && runtimeTiming.durationMs > 0) return;
    setCompletedStageDurationMsByStage((current) => (
      shallowEqualNumberRecord(current, {}) ? current : {}
    ));
  }, [buildStatus, sessionStageDurationSnapshot, runtimeTiming.durationMs]);

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

  useEffect(() => {
    if (!activeNodeId) return;
    if (isElapsedResetState) return;
    const merged = mergeElapsedByStage(stageElapsedByStage, sessionStageDurationSnapshot);
    if (!shallowEqualNumberRecord(stageElapsedByStage, merged)) {
      setCompletedStageDurationMsByStage(merged);
    }
  }, [
    activeNodeId,
    isElapsedResetState,
    sessionStageDurationSnapshot,
    stageElapsedByStage,
  ]);

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
