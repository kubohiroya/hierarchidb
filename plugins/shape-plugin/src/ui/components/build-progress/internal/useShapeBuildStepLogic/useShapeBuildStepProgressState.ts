import { useEffect, useMemo, useRef, useState } from 'react';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildProgress, BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildProgressSummaryComputation } from '~/ui/components/build-progress/useShapeBuildProgressSummaryComputation.js';
import {
  buildElapsedByStageWithActiveStage,
  hasPositiveElapsed,
  mergeElapsedByStage,
  resolveTotalElapsedMs,
  shallowEqualNumberRecord,
  shouldResetElapsedState,
} from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/elapsed.js';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
} from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage.js';
import type { StageId } from '~/ui/components/build-progress/useShapeBuildTaskSnapshotProgressState/useShapeBuildTaskSnapshotProgressState';

type SessionRecordLike = {
  elapsedByStage?: Record<string, number> | null;
  elapsedMs?: number | null;
  stageId?: string | null;
  startedAt?: number | null;
  completedAt?: number | null;
  updatedAt?: number | null;
  inactiveMs?: number | null;
  lastHeartbeatAt?: number | null;
  stageStartedAt?: number | null;
  stageHeartbeatAt?: number | null;
  stageInactiveMs?: number | null;
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
  sessionRecord: SessionRecordLike | null | undefined;
  activeNodeId: string | null;
  updateSessionRecord: (patch: {
    elapsedByStage: Record<string, number>;
    elapsedMs: number;
    stageId?: string;
  }) => void | Promise<void>;
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
  sessionRecord,
  activeNodeId,
  updateSessionRecord,
}: Args) => {
  const persistedStageElapsedByStage = useMemo<Record<string, number>>(
    () => (sessionRecord?.elapsedByStage ?? {}),
    [sessionRecord?.elapsedByStage],
  );
  const persistedStageElapsedStageId = useMemo(() => (
    typeof sessionRecord?.stageId === 'string' ? sessionRecord.stageId : null
  ), [sessionRecord?.stageId]);

  const [completedStageElapsedMs, setCompletedStageElapsedMs] = useState<Record<string, number>>(
    () => persistedStageElapsedByStage,
  );
  const [timingStageId, setTimingStageId] = useState<string | null>(persistedStageElapsedStageId);
  const [displayStageRemainingMs, setDisplayStageRemainingMs] = useState<number | null>(null);
  const stageRemainingTickRef = useRef<number | null>(null);
  const latestStageRemainingMsRef = useRef<number | null>(null);
  const lastPersistedStageMapRef = useRef<Record<string, number> | null>(null);
  const lastPersistedStageIdRef = useRef<string | null>(null);
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
      buildElapsedMs: sessionRecord?.elapsedMs ?? undefined,
      stageElapsedByStage: persistedStageElapsedByStage,
      localElapsedByStage: completedStageElapsedMs,
    }),
    [
      buildStatus,
      completedStageElapsedMs,
      sessionRecord?.elapsedMs,
      persistedStageElapsedByStage,
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
      ?? persistedStageElapsedStageId
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
    persistedStageElapsedStageId,
    runningStageIdFromTasks,
    timingFallbackStage,
    timingStageId,
  ]);

  const resolvedStageFromState = stageFromState ?? resolvedStage ?? stages[0]?.id;

  const stageElapsedMs = timingStageId ? (completedStageElapsedMs[timingStageId] ?? 0) : 0;
  const resolvedStageElapsedMs = useMemo(() => {
    if (!timingStageId) {
      return 0;
    }
    if (timingStageId !== persistedStageElapsedStageId || !sessionRecord?.stageStartedAt) {
      return stageElapsedMs;
    }
    const stageBaseTime = buildStatus === 'running'
      ? Date.now()
      : sessionRecord.stageHeartbeatAt ?? sessionRecord.lastHeartbeatAt ?? Date.now();
    const activeStageElapsedMs = Math.max(
      0,
      stageBaseTime - sessionRecord.stageStartedAt - (sessionRecord.stageInactiveMs ?? 0),
    );
    return Math.max(stageElapsedMs, activeStageElapsedMs);
  }, [
    buildStatus,
    persistedStageElapsedStageId,
    sessionRecord?.lastHeartbeatAt,
    sessionRecord?.stageHeartbeatAt,
    sessionRecord?.stageInactiveMs,
    sessionRecord?.stageStartedAt,
    stageElapsedMs,
    timingStageId,
  ]);

  const stageElapsedByStage = useMemo<Record<string, number>>(() => (
    buildElapsedByStageWithActiveStage({
      elapsedByStage: completedStageElapsedMs,
      timingStageId,
      timingStageElapsedMs: resolvedStageElapsedMs,
    })
  ), [completedStageElapsedMs, resolvedStageElapsedMs, timingStageId]);

  const resolvedSessionElapsedMs = useMemo(() => {
    if (typeof sessionRecord?.elapsedMs === 'number' && sessionRecord.elapsedMs > 0) {
      return sessionRecord.elapsedMs;
    }
    const startedAt = sessionRecord?.startedAt;
    if (typeof startedAt !== 'number' || Number.isNaN(startedAt) || startedAt <= 0) {
      return 0;
    }
    const inactiveMs = sessionRecord?.inactiveMs ?? 0;
    const endAt = buildStatus === 'running'
      ? Date.now()
      : (sessionRecord?.lastHeartbeatAt ?? sessionRecord?.completedAt ?? sessionRecord?.updatedAt ?? Date.now());
    return Math.max(0, endAt - startedAt - inactiveMs);
  }, [
    buildStatus,
    sessionRecord?.completedAt,
    sessionRecord?.inactiveMs,
    sessionRecord?.lastHeartbeatAt,
    sessionRecord?.startedAt,
    sessionRecord?.updatedAt,
  ]);

  const totalElapsedMs = useMemo(() => resolveTotalElapsedMs({
    buildStatus,
    elapsedByStage: stageElapsedByStage,
    sessionElapsedMs: resolvedSessionElapsedMs,
  }), [buildStatus, resolvedSessionElapsedMs, stageElapsedByStage]);

  useEffect(() => {
    if (isElapsedResetState) {
      setCompletedStageElapsedMs((current) => {
        if (shallowEqualNumberRecord(current, {})) return current;
        return {};
      });
      return;
    }
    setCompletedStageElapsedMs((current) => {
      const merged = mergeElapsedByStage(current, persistedStageElapsedByStage);
      if (shallowEqualNumberRecord(current, merged)) return current;
      return merged;
    });
  }, [isElapsedResetState, persistedStageElapsedByStage]);

  useEffect(() => {
    if (!isElapsedResetState) return;
    setDisplayStageRemainingMs(null);
    stageRemainingTickRef.current = null;
    latestStageRemainingMsRef.current = null;
    lastPersistedStageMapRef.current = null;
    lastPersistedStageIdRef.current = null;
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
    && timingStageId === persistedStageElapsedStageId
    && typeof sessionRecord?.stageStartedAt === 'number'
    && sessionRecord.stageStartedAt > 0
  ), [persistedStageElapsedStageId, sessionRecord?.stageStartedAt, timingStageId]);
  const isTimingStageActive = isTimingStageRunning || isTimingStageSessionActive;

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (!timingStageId) return;
    if (!isTimingStageActive) return;
    const intervalId = window.setInterval(() => {
      setCompletedStageElapsedMs((current) => {
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
    if (hasPositiveElapsed(persistedStageElapsedByStage)) return;
    if (typeof sessionRecord?.elapsedMs === 'number' && sessionRecord.elapsedMs > 0) return;
    setCompletedStageElapsedMs((current) => (
      shallowEqualNumberRecord(current, {}) ? current : {}
    ));
  }, [buildStatus, persistedStageElapsedByStage, sessionRecord?.elapsedMs]);

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
    if (isElapsedResetState) {
      lastPersistedStageMapRef.current = null;
      lastPersistedStageIdRef.current = null;
      return;
    }

    const merged = mergeElapsedByStage(stageElapsedByStage, persistedStageElapsedByStage);
    if (!shallowEqualNumberRecord(stageElapsedByStage, merged)) {
      setCompletedStageElapsedMs(merged);
      return;
    }

    const stageId = timingStageId ?? null;
    const mapUnchanged = shallowEqualNumberRecord(stageElapsedByStage, persistedStageElapsedByStage);
    const stageUnchanged = lastPersistedStageIdRef.current === stageId;
    if (mapUnchanged && stageUnchanged) return;
    if (
      lastPersistedStageMapRef.current
      && shallowEqualNumberRecord(lastPersistedStageMapRef.current, stageElapsedByStage)
      && stageUnchanged
    ) {
      return;
    }

    lastPersistedStageMapRef.current = stageElapsedByStage;
    lastPersistedStageIdRef.current = stageId;

    void updateSessionRecord({
      elapsedByStage: stageElapsedByStage,
      elapsedMs: totalElapsedMs,
      stageId: stageId ?? undefined,
    });
  }, [
    activeNodeId,
    isElapsedResetState,
    persistedStageElapsedByStage,
    stageElapsedByStage,
    timingStageId,
    totalElapsedMs,
    updateSessionRecord,
  ]);

  return {
    persistedStageElapsedByStage,
    persistedStageElapsedStageId,
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
