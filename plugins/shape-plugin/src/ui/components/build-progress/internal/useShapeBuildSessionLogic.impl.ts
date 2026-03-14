import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useBuildProgress } from '~/ui/components/build-progress/useBuildProgress/useBuildProgress';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  DEFAULT_PROCESSING_CONFIG,
  summarizeCheckboxState,
  validateBuildConfig,
  type ShapeEntity,
} from '~/common/types/index';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { useShapeBuildAutoResume } from '~/ui/components/build-progress/useShapeBuildAutoResume/useShapeBuildAutoResume';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { useShapeBuildStages } from '~/ui/components/build-progress/useShapeBuildStages/useShapeBuildStages';
import { useShapeBuildLabels } from '~/ui/components/build-progress/useShapeBuildLabels/useShapeBuildLabels';
import { resolveBuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import type { BuildSessionDisplayStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { useShapeBuildSessionState } from './useShapeBuildSessionState.js';

const POLL_INTERVAL_MS = 1000;
import {
  getBuildSessionTransitionStatusLabel,
} from './useShapeBuildSessionHelpers/startupTrace.js';
import {
  shouldResetElapsedState,
} from './useShapeBuildSessionHelpers/elapsed.js';
import {
  resolveDisplayBuildStatus,
  toBuildStatus,
  toProcessingStatus,
  shouldRefreshTasksSnapshot,
} from './useShapeBuildSessionHelpers/status.js';
import {
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
} from './useShapeBuildSessionHelpers/stage.js';
import { useShapeBuildSessionControlActions } from './useShapeBuildSessionControlActions.js';
import { useShapeBuildSessionStartupLifecycle } from './useShapeBuildSessionStartupLifecycle.js';
import { useShapeBuildSessionTransitionController } from './useShapeBuildSessionLogic/useShapeBuildSessionTransitionController.js';
import { useShapeBuildSessionStageState } from './useShapeBuildSessionStageState.js';
import { useShapeBuildSessionProgressState } from './useShapeBuildSessionLogic/useShapeBuildSessionProgressState.js';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import { notify } from '@hierarchidb/components/notify';
import { useShapeBuildDraftSaver } from './useShapeBuildSessionLogic/useShapeBuildDraftSaver.js';
import { useShapeBuildProgressResidueMonitor } from './useShapeBuildSessionLogic/useShapeBuildProgressResidueMonitor.js';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  buildSessionLifecycleAtom,
  pendingUserActionAtom,
  isStopRequestedInFlightAtom,
  stageDurationMsByStageAtom,
  stageTimingByStageAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import type { PendingUserAction } from '~/ui/atoms/buildSessionStateAtoms';

export {
  shouldResetElapsedState,
  resolveDisplayBuildStatus,
  resolveMostAdvancedRunningStageId,
  resolveMostAdvancedInFlightStageId,
  shouldRefreshTasksSnapshot,
};

type RuntimeBuildStatus = BuildSessionDisplayStatus['status'];

const resolveRuntimeBuildStatus = (status?: RuntimeBuildStatus | null): BuildStatusSource | null => {
  if (status == null) return null;
  if (
    status === 'idle'
    || status === 'running'
    || status === 'queued'
    || status === 'completed'
    || status === 'paused'
    || status === 'failed'
  ) {
    return status;
  }
  return null;
};

type Args = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
};

export const useShapeBuildSession = ({ data, nodeId }: Args) => {
  const { t } = useTranslation('shape-plugin');
  const activeNodeId = nodeId ?? null;
  const runtime = useAtomValue(buildSessionLifecycleAtom);
  const stageDurationMsByStage = useAtomValue(stageDurationMsByStageAtom);
  const stageTimingByStage = useAtomValue(stageTimingByStageAtom);

  const releaseBuildLock = useCallback(() => { }, []);

  const tryAcquireBuildLock = useCallback(async (options?: { notifyOnFailure?: boolean }): Promise<boolean> => {
    if (options?.notifyOnFailure && typeof navigator !== 'undefined' && typeof navigator.locks?.request !== 'function') {
      notify.warning('Web Locks API is unavailable. Continuing in SharedWorker queue mode.');
    }
    return true;
  }, []);

  const sleep = useCallback((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)), []);

  const cancelStartRequestRef = useRef(false);

  const waitForBuildLock = useCallback(async (_requestedAt: number): Promise<boolean> => {
    if (!activeNodeId) return false;
    while (!cancelStartRequestRef.current) {
      await sleep(POLL_INTERVAL_MS);
      return true;
    }
    return false;
  }, [activeNodeId, sleep]);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const clearStartPendingRef = useRef<(() => void) | null>(null);
  const {
    updateSessionRecord,
  } = useShapeBuildSessionState({
    activeNodeId,
  });
  const {
    buildSessionTransition,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
    emitBuildSessionTransitionLog,
    beginBuildStartupStep,
    finishBuildStartupStep,
    progressTerminalLogKeyRef,
  } = useShapeBuildSessionTransitionController({
    activeNodeId,
    clearStartPendingRef,
  });


  const { progress, status, error } = useBuildProgress(activeNodeId);
  const hasNodeId = Boolean(activeNodeId && !error);
  const effectiveProgress = hasNodeId ? progress : null;
  const effectiveStatus = hasNodeId ? status : null;
  const stages = useShapeBuildStages({ t: (key: string, fallback?: string): string => String(t(key, fallback ?? key)) });
  const runtimeStatusForBuildStatus: BuildSessionDisplayStatus['status'] = status?.status ?? 'idle';
  const runtimeStatus: BuildSessionDisplayStatus['status'] = runtimeStatusForBuildStatus;
  const pendingUserAction = useAtomValue(pendingUserActionAtom);
  const setPendingUserAction = useSetAtom(pendingUserActionAtom);
  const isStopRequestedInFlight = useAtomValue(isStopRequestedInFlightAtom);
  const isSessionStopping = isStopRequestedInFlight;

  const setIsStopRequested = useCallback((next: boolean) => {
    if (next) {
      setPendingUserAction('stopping');
    } else {
      if (pendingUserAction === 'stopping') {
        setPendingUserAction('none');
      }
    }
  }, [setPendingUserAction, pendingUserAction]);

  const setIsStopAccepted = useCallback((_next: boolean) => {
    // Stop acceptance is now tracked via pendingUserAction transitions
  }, []);

  const setRequestedControlAction = useCallback((next: 'none' | 'start' | 'pause' | 'cancel') => {
    const mapping: Record<string, PendingUserAction> = {
      none: 'none',
      start: 'starting',
      pause: 'pausing',
      cancel: 'cancelling',
    };
    setPendingUserAction(mapping[next] ?? 'none');
  }, [setPendingUserAction]);

  const requestedControlAction = useMemo(() => {
    if (pendingUserAction === 'starting') return 'start' as const;
    if (pendingUserAction === 'pausing') return 'pause' as const;
    if (pendingUserAction === 'cancelling') return 'cancel' as const;
    return 'none' as const;
  }, [pendingUserAction]);
  const processingStatus = toProcessingStatus(runtimeStatusForBuildStatus);
  const stopReason = runtime.stopReason;
  const statusSource = useMemo(() => {
    return resolveBuildStatusSource(processingStatus, resolveRuntimeBuildStatus(runtimeStatus));
  }, [processingStatus, runtimeStatus]);
  const effectiveStatusSource = useMemo(() => {
    if (isSessionStopping) return 'paused';
    return statusSource;
  }, [isSessionStopping, statusSource]);
  const reportTaskFailures = effectiveStatusSource === 'running';
  const baseBuildStatus = useMemo<BuildStatus>(() => (
    toBuildStatus(effectiveStatusSource)
  ), [effectiveStatusSource]);
  const stageState = useShapeBuildSessionStageState({
    activeNodeId,
    isSessionStopping,
    stages,
    processingStatus,
    runtimeStatus: runtimeStatusForBuildStatus,
    effectiveProgress: effectiveProgress
      ? {
        percentage: effectiveProgress.percentage,
        stage: effectiveProgress.stage,
        progressTaskId: effectiveProgress.progressTaskId,
        progressTaskStage: (effectiveProgress as { progressTaskStage?: string | null }).progressTaskStage ?? null,
      }
      : null,
    sessionProgressTotal: effectiveProgress?.total,
    hasNodeId,
    reportFailures: reportTaskFailures,
    baseBuildStatus,
    onTerminalStageCompletion: async ({ completed, hasFailedTerminalTasks }) => {
      if (buildSessionTransition.active) {
        return;
      }
      if (!completed || runtimeStatusForBuildStatus === 'completed' || runtimeStatusForBuildStatus === 'failed') {
        return;
      }
      const status = hasFailedTerminalTasks ? 'failed' : 'completed';
      const stopReason: ShapeBuildStopReason = status === 'failed' ? 'failed' : 'completed';
      await updateSessionRecord({
        status,
        stopReason,
        canResume: false,
        completedAt: Date.now(),
      });
    },
  });
  const {
    tasks: displayTasks,
    isLoading: isTasksLoading,
    stageFromState,
    liveStageFromState,
    resolvedStageFromState,
    buildStatus,
    taskListViewPhase,
  } = stageState;

  const {
    completedStageElapsedMs,
    timingStageId,
    stageElapsedMs,
    totalElapsedMs,
    displayStageRemainingMs,
    progressSummary,
    hasFailedSourceTasks,
    isTaskSummaryLoading,
  } = useShapeBuildSessionProgressState({
    buildStatus,
    stages,
    resolvedStage: resolvedStageFromState,
    liveStage: liveStageFromState,
    timingFallbackStage: resolvedStageFromState ?? null,
    displayTasks,
    overallProgress: effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0,
    effectiveProgress: effectiveProgress ?? null,
    effectiveStatus: effectiveStatus ?? null,
    stageFromState,
    sessionStageDurationByStageSnapshot: stageDurationMsByStage,
    runtimeTiming: {
      startedAt: runtime.startedAt,
      completedAt: runtime.completedAt,
      heartbeatAt: runtime.heartbeatAt,
      stageId: runtime.activeStageId,
      stageStartedAt: stageTimingByStage[runtime.activeStageId]?.stageStartedAt,
      stageInactiveMs: stageTimingByStage[runtime.activeStageId]?.stageInactiveMs,
    },
  });

  const { buildSessionTransitionElapsedMs: startupLifecycleElapsedMs } = useShapeBuildSessionStartupLifecycle({
    activeNodeId,
    buildSessionTransition,
    buildStatus: effectiveStatusSource,
    resolveStage: effectiveProgress?.progressTaskStage ?? null,
    effectiveProgress,
    progressTerminalLogKeyRef,
    emitBuildSessionTransitionLog,
  });

  const selectedArrayByCountries = data?.selectedArrayByCountries;
  const {
    statusLabel,
    warningMessage,
    stageLabel,
    taskLabel,
    taskUnitLabel,
  } = useShapeBuildLabels({
    t,
    buildStatus,
    effectiveStatus: effectiveStatus ?? null,
    effectiveProgress: effectiveProgress ?? null,
    stages,
    resolvedTaskType: timingStageId ?? resolvedStageFromState,
    displayStageId: progressSummary.displayStageId,
    rawDisplayCounts: progressSummary.rawDisplayCounts,
  });

  const isProcessingValid = useMemo(() => {
    if (!data?.buildConfig) return false;
    return validateBuildConfig(
      data.buildConfig,
      data.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
    ).isValid;
  }, [data?.buildConfig, data?.processingConfig]);

  const showResumeLabel = useMemo(() => (
    buildStatus !== 'paused' && (!buildSessionTransition.active && displayTasks.length > 0)
  ), [buildStatus, displayTasks.length, buildSessionTransition.active]);
  const hasSelection = summarizeCheckboxState(selectedArrayByCountries).hasSelection;
  const hasDataSource = Boolean(data?.buildConfig?.dataSourceName);
  const buildStatusForProgressMonitor: BuildSessionDisplayStatus['status'] = (
    buildStatus === 'running' ? 'running' : buildStatus
  );
  const bridgeRef = useRef(getBuildWorkerBridge());
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const { saveDraftBeforeBuild } = useShapeBuildDraftSaver({
    activeNodeId,
    data,
    workerClient,
  });
  const displayTotalElapsedMs = totalElapsedMs;

  const {
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: closeCrashSuspect,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: closeSuspendSuspect,
  } = useShapeBuildProgressResidueMonitor({
    activeNodeId,
    buildSessionTransitionActive: buildSessionTransition.active,
    crashCheckStartedAtRef,
    buildStatus: buildStatusForProgressMonitor,
    runtimeStatus: runtimeStatusForBuildStatus,
    runtimeHeartbeatAt: runtime.heartbeatAt,
    shouldMonitor: runtimeStatusForBuildStatus === 'running' && runtime.completedAt === undefined,
    t: (key: string, fallback: string) => t(key, fallback),
    closeCrashSuspect: () => { },
    closeSuspendSuspect: () => { },
  });

  const {
    handleStart,
    handlePause,
    handleCancelQueued,
  } = useShapeBuildSessionControlActions({
    activeNodeId,
    data,
    buildStatus,
    runtimeStatus: runtimeStatusForBuildStatus,
    buildSessionTransitionActive: buildSessionTransition.active,
    isStopRequestedInFlight,
    bridgeRef,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
    beginBuildStartupStep,
    finishBuildStartupStep,
    emitBuildSessionTransitionLog,
    clearStartPendingRef,
    releaseBuildLock,
    tryAcquireBuildLock,
    waitForBuildLock,
    cancelStartRequestRef,
    setRequestedControlAction,
    saveDraftBeforeBuild,
    updateSessionRecord,
    setIsStopRequested,
    setIsStopAccepted,
  });

  // Clean up stale pause/cancel actions after stop request completes
  useEffect(() => {
    if (isStopRequestedInFlight) return;
    if (requestedControlAction === 'pause' || requestedControlAction === 'cancel') {
      setRequestedControlAction('none');
    }
  }, [isStopRequestedInFlight, requestedControlAction, setRequestedControlAction]);

  // Auto-reset pendingUserAction when session reaches terminal/paused state
  useEffect(() => {
    if (!isStopRequestedInFlight) return;
    if (
      runtimeStatusForBuildStatus === 'paused'
      || runtimeStatusForBuildStatus === 'completed'
      || runtimeStatusForBuildStatus === 'failed'
    ) {
      setPendingUserAction('none');
    }
  }, [isStopRequestedInFlight, runtimeStatusForBuildStatus, setPendingUserAction]);

  const { canStart, isStartPending, start, clearStartPending } = useShapeBuildAutoResume({
    activeNodeId,
    buildStatus,
    stopReason,
    runtimeStatus,
    handleStart,
    handlePause,
    hasFailedSourceTasks,
    hasDataSource,
    hasSelection,
    isProcessingValid,
    isLockSupported: true,
  });
  useEffect(() => {
    clearStartPendingRef.current = clearStartPending;
  }, [clearStartPending]);
  const effectiveBuildStatus: BuildStatus = buildStatus;
  const effectiveStatusLabel = buildSessionTransition.active
    ? getBuildSessionTransitionStatusLabel(t, buildSessionTransition.phase, startupLifecycleElapsedMs)
    : isStartPending && buildStatus === 'idle'
      ? t('build.status.starting', 'Starting stage...')
      : statusLabel;
  return {
    t,
    stages,
    stageProgress: progressSummary.stageProgress,
    paneProgress: progressSummary.paneProgress,
    tasksByStage: progressSummary.tasksByStage,
    tasks: displayTasks,
    isTasksLoading,
    isTaskSummaryLoading,
    buildStatus: effectiveBuildStatus,
    overallProgress: progressSummary.displayCounts.percentage,
    stageLabel,
    taskLabel,
    taskUnitLabel,
    statusLabel: effectiveStatusLabel,
    completed: progressSummary.displayCounts.completed,
    total: progressSummary.displayCounts.total,
    failed: progressSummary.displayCounts.failed,
    skipped: progressSummary.displayCounts.skipped,
    hasProgressData: progressSummary.hasProgressData,
    taskListViewPhase,
    stageTotals: progressSummary.stageTotals,
    timingStageId,
    completedStageElapsedMs,
    warningMessage,
    showResumeLabel,
    canStart,
    handleStart: start,
    handlePause,
    handleCancelQueued,
    isStartPending,
    requestedControlAction,
    stopRequested: isStopRequestedInFlight,
    totalElapsedMs: displayTotalElapsedMs,
    stageElapsedMs,
    stageRemainingMs: displayStageRemainingMs,
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: closeCrashSuspect,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: closeSuspendSuspect,
  };
};
