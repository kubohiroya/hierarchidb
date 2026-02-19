import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue, useSetAtom } from 'jotai';
import { useShapeBuildTasks } from '~/ui/components/build-progress/useShapeBuildTasks/useShapeBuildTasks';
import { useBuildProgress } from '~/ui/components/build-progress/useBuildProgress/useBuildProgress';
import { useTranslation } from '~/ui/i18n';
import {
  DEFAULT_PROCESSING_CONFIG,
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '~/common/types/index';
import {
  useBuildSessionTransition,
  type BuildSessionTransitionNotificationLevel,
} from '@hierarchidb/components/build-session';
import { notify } from '@hierarchidb/components/notify';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import { isTaskPhaseDisplay, isTaskSkipped } from '~/common/utils/taskMessages';
import { getMemorySnapshot } from '@hierarchidb/ui-monitoring';
import { useShapeBuildAutoResume } from '~/ui/components/build-progress/useShapeBuildAutoResume/useShapeBuildAutoResume';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { AuthProviderType } from '@hierarchidb/ui-auth';
import { useShapeBuildStages } from '~/ui/components/build-progress/useShapeBuildStages/useShapeBuildStages';
import { useShapeBuildLabels } from '~/ui/components/build-progress/useShapeBuildLabels/useShapeBuildLabels';
import { resolveBuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import { createBuildStartDraftData } from '~/ui/components/build-progress/createBuildStartDraftData';
import { hasAwaitingFirstTaskSignal } from '~/ui/components/build-progress/awaitingFirstTaskSignal';
import { resolveAwaitingFirstTaskDecision } from '~/ui/components/build-progress/resolveAwaitingFirstTaskDecision';
import {
  resolveStartupTransitionWatchdogEvent,
} from '~/ui/components/build-progress/resolveStartupTransitionWatchdogEvent';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/batch/ShapeBuildAPIClient';
import { persistedTasksAtom, type ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { UI_POLL_INTERVAL_MS, UI_QUIET_THRESHOLD_MS } from './useShapeBuildStepHelpers/constants.js';
import {
  emitShapeProgressStepTrace,
  isShapeProgressStepDebugEnabled,
} from './useShapeBuildStepHelpers/debug.js';
import {
  hasPositiveElapsed,
  mergeElapsedByStage,
  shallowEqualNumberRecord,
  shouldResetElapsedState,
  sumNumberRecord,
} from './useShapeBuildStepHelpers/elapsed.js';
import {
  type BuildStartupTransitionWarnStep,
  resolveDisplayBuildStatus,
  shouldRefreshTasksSnapshot,
  toBuildStatus,
  toProcessingStatus,
} from './useShapeBuildStepHelpers/status.js';
import {
  normalizeStageKey,
  resolveMostAdvancedInFlightStageId,
  resolveMostAdvancedRunningStageId,
} from './useShapeBuildStepHelpers/stage.js';
import { useShapeBuildStepControlActions } from './useShapeBuildStepControlActions.js';
import { useShapeBuildProgressSummaryComputation } from '~/ui/components/build-progress/shapeBuildProgressSummaryComputation';

export {
  shouldResetElapsedState,
  resolveDisplayBuildStatus,
  shouldRefreshTasksSnapshot,
  resolveMostAdvancedRunningStageId,
  resolveMostAdvancedInFlightStageId,
};

type ShapeProgressStepTracePayload = {
  nodeId: string | null;
  phase: BuildStatus;
  progressTaskId: string | null;
  progressTaskStatus: string | null;
  progressTaskStage: string | null;
  progressTaskProgress: number | null;
  percentage: number | null;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  message: string | null;
};

type BuildSessionTransitionPhase =
  | 'acquiring-lock'
  | 'waiting-lock'
  | 'saving-draft'
  | 'initializing-worker'
  | 'building-payloads'
  | 'starting-session'
  | 'awaiting-first-task';

type NotificationLevel = BuildSessionTransitionNotificationLevel;
type BuildStartupStep =
  | 'lock-acquire'
  | 'lock-wait'
  | 'draft-save'
  | 'worker-initialize'
  | 'payload-build'
  | 'session-resume-request'
  | 'session-start-request'
  | 'session-status-persist'
  | 'awaiting-first-task';
type BuildStartupStepOutcome = 'success' | 'error' | 'cancelled' | 'aborted';
type StartupStepMemorySnapshot = {
  usedJSHeapSize: number | null;
  totalJSHeapSize: number | null;
  jsHeapSizeLimit: number | null;
};

const toMemoryValue = (value: number | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const captureStartupStepMemorySnapshot = (): StartupStepMemorySnapshot => {
  const snapshot = getMemorySnapshot();
  return {
    usedJSHeapSize: toMemoryValue(snapshot.usedJSHeapSize),
    totalJSHeapSize: toMemoryValue(snapshot.totalJSHeapSize),
    jsHeapSizeLimit: toMemoryValue(snapshot.jsHeapSizeLimit),
  };
};

const subtractMemoryValues = (started: number | null | undefined, finished: number | null): number | null => {
  if (started === null || started === undefined || finished === null) {
    return null;
  }
  return finished - started;
};

const calculateMemoryDelta = (
  started: StartupStepMemorySnapshot | null,
  finished: StartupStepMemorySnapshot,
): StartupStepMemorySnapshot => ({
  usedJSHeapSize: subtractMemoryValues(started?.usedJSHeapSize, finished.usedJSHeapSize),
  totalJSHeapSize: subtractMemoryValues(started?.totalJSHeapSize, finished.totalJSHeapSize),
  jsHeapSizeLimit: subtractMemoryValues(started?.jsHeapSizeLimit, finished.jsHeapSizeLimit),
});

const getBuildSessionTransitionStatusLabel = (
  t: (key: string, fallback?: string) => string,
  phase: BuildSessionTransitionPhase | 'idle',
  elapsedMs: number,
): string => {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  switch (phase) {
    case 'acquiring-lock':
      return t('stage.status.startingLock', 'Starting build (acquiring lock)...');
    case 'waiting-lock':
      return t('stage.status.startingQueueElapsed', `Starting build (waiting for lock, ${elapsedSeconds}s)...`);
    case 'saving-draft':
      return t('stage.status.startingSave', 'Starting build (saving draft)...');
    case 'initializing-worker':
      return t('stage.status.startingWorker', 'Starting build (initializing worker)...');
    case 'building-payloads':
      return t('stage.status.startingPayload', 'Starting build (preparing tasks)...');
    case 'starting-session':
      return t('stage.status.startingSession', 'Starting build (launching session)...');
    case 'awaiting-first-task':
      return t('stage.status.startingAwaitElapsed', `Build requested; waiting for first task (${elapsedSeconds}s)...`);
    default:
      return t('stage.status.starting', 'Starting stage...');
  }
};

type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: NodeId;
};

export const useShapeBuildStep = ({ data, nodeId }: Args) => {
  const { t } = useTranslation();
  const activeNodeId = nodeId ?? null;

  const releaseBuildLock = useCallback(() => {}, []);

  const tryAcquireBuildLock = useCallback(async (options?: { notifyOnFailure?: boolean }): Promise<boolean> => {
    if (options?.notifyOnFailure && typeof navigator !== 'undefined' && typeof navigator.locks?.request !== 'function') {
      notify.warning('Web Locks API is unavailable. Continuing in SharedWorker queue mode.');
    }
    return true;
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForBuildLock = useCallback(async (_requestedAt: number): Promise<boolean> => {
    if (!activeNodeId) return false;
    while (!cancelStartRequestRef.current) {
      await sleep(UI_POLL_INTERVAL_MS);
      return true;
    }
    return false;
  }, [activeNodeId]);
  const crashCheckStartedAtRef = useRef<number>(Date.now());

  const [isStopRequested, setIsStopRequested] = useState(false);
  const [isStopAccepted, setIsStopAccepted] = useState(false);
  const clearStartPendingRef = useRef<(() => void) | null>(null);
  const buildSessionTransitionWarnStepRef = useRef<BuildStartupTransitionWarnStep>(0);
  const buildSessionTransitionTaskStartNotifiedRef = useRef(false);
  const buildSessionTransitionWaitLogStepRef = useRef(-1);
  const cancelStartRequestRef = useRef(false);
  const awaitingFirstTaskExpectationRef = useRef(false);
  const buildStartupStepStartedAtRef = useRef<Map<BuildStartupStep, number>>(new Map());
  const buildStartupStepMemoryAtStartRef = useRef<Map<BuildStartupStep, StartupStepMemorySnapshot>>(new Map());
  const previousTransitionActiveRef = useRef(false);
  const progressTerminalLogKeyRef = useRef<string | null>(null);
  const [buildSessionTransitionElapsedMs, setBuildSessionTransitionElapsedMs] = useState(0);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
  const [sessionRecord, setSessionRecord] = useState<ShapeBuildSessionRecord | null>(null);
  const lastWorkerStageTraceKeyRef = useRef<string | null>(null);
  const lastAwaitingFirstTaskDecisionTraceKeyRef = useRef<string | null>(null);
  const persistedStageElapsedByStage = useMemo<Record<string, number>>(
    () => (sessionRecord?.elapsedByStage ?? {}),
    [sessionRecord?.elapsedByStage]
  );
  const [completedStageElapsedMs, setCompletedStageElapsedMs] = useState<Record<string, number>>(
    () => persistedStageElapsedByStage
  );
  const lastPersistedStageMapRef = useRef<Record<string, number> | null>(null);
  const lastPersistedStageIdRef = useRef<string | null>(null);
  const closeCrashSuspect = useCallback(() => {
    setCrashSuspectOpen(false);
    setCrashSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
  }, []);
  const closeSuspendSuspect = useCallback(() => {
    setSuspendSuspectOpen(false);
    setSuspendSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
  }, []);
  const buildSessionTransitionContext = useMemo(() => ({
    nodeId: activeNodeId ? String(activeNodeId) : null,
  }), [activeNodeId]);
  const handleBuildSessionTransitionNotify = useCallback((level: NotificationLevel, message: string) => {
    if (level === 'error') {
      notify.error(message);
      return;
    }
    if (level === 'warning') {
      notify.warning(message);
      return;
    }
    if (level === 'success') {
      notify.success(message);
      return;
    }
    notify.info(message);
  }, []);
  const handleBuildSessionTransitionFinish = useCallback(() => {
    clearStartPendingRef.current?.();
    buildSessionTransitionWarnStepRef.current = 0;
    buildSessionTransitionTaskStartNotifiedRef.current = false;
    buildSessionTransitionWaitLogStepRef.current = -1;
    awaitingFirstTaskExpectationRef.current = false;
    progressTerminalLogKeyRef.current = null;
    setBuildSessionTransitionElapsedMs(0);
  }, []);
  const {
    buildSessionTransition,
    beginBuildSessionTransition: beginBuildSessionTransitionInternal,
    advanceBuildSessionTransitionPhase: advanceBuildSessionTransitionPhaseInternal,
    finishBuildSessionTransition: finishBuildSessionTransitionInternal,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
  } = useBuildSessionTransition<BuildSessionTransitionPhase>({
    logPrefix: '[ShapeBuildProgressStep]',
    context: buildSessionTransitionContext,
    onNotify: handleBuildSessionTransitionNotify,
    onFinish: handleBuildSessionTransitionFinish,
  });
  const beginBuildSessionTransition = useCallback((phase: BuildSessionTransitionPhase, message?: string) => {
    const now = Date.now();
    buildSessionTransitionWarnStepRef.current = 0;
    buildSessionTransitionTaskStartNotifiedRef.current = false;
    buildSessionTransitionWaitLogStepRef.current = -1;
    progressTerminalLogKeyRef.current = null;
    setBuildSessionTransitionElapsedMs(0);
    beginBuildSessionTransitionInternal(phase, {
      message,
      level: 'info',
      extra: { startedAt: now },
    });
  }, [beginBuildSessionTransitionInternal]);
  const advanceBuildSessionTransitionPhase = useCallback((phase: BuildSessionTransitionPhase, options?: { message?: string; level?: NotificationLevel }) => {
    advanceBuildSessionTransitionPhaseInternal(phase, {
      message: options?.message,
      level: options?.level ?? 'info',
    });
  }, [advanceBuildSessionTransitionPhaseInternal]);
  const finishBuildSessionTransition = useCallback((options?: { message?: string; level?: NotificationLevel }) => {
    finishBuildSessionTransitionInternal(options);
  }, [finishBuildSessionTransitionInternal]);
  const beginBuildStartupStep = useCallback((step: BuildStartupStep, extra?: Record<string, unknown>) => {
    const startedAt = Date.now();
    const memoryAtStart = captureStartupStepMemorySnapshot();
    buildStartupStepStartedAtRef.current.set(step, startedAt);
    buildStartupStepMemoryAtStartRef.current.set(step, memoryAtStart);
    emitBuildSessionTransitionLog('info', 'build startup step start', {
      step,
      startedAt,
      memory: memoryAtStart,
      ...(extra ?? {}),
    });
  }, [emitBuildSessionTransitionLog]);
  const finishBuildStartupStep = useCallback((
    step: BuildStartupStep,
    outcome: BuildStartupStepOutcome,
    extra?: Record<string, unknown>,
  ) => {
    const now = Date.now();
    const startedAt = buildStartupStepStartedAtRef.current.get(step);
    const memoryAtStart = buildStartupStepMemoryAtStartRef.current.get(step) ?? null;
    buildStartupStepStartedAtRef.current.delete(step);
    buildStartupStepMemoryAtStartRef.current.delete(step);
    const memoryAtFinish = captureStartupStepMemorySnapshot();
    const memoryDelta = calculateMemoryDelta(memoryAtStart, memoryAtFinish);
    const elapsedMs = typeof startedAt === 'number' ? Math.max(0, now - startedAt) : null;
    const level = outcome === 'error' ? 'error' : outcome === 'success' ? 'info' : 'warn';
    emitBuildSessionTransitionLog(level, 'build startup step finish', {
      step,
      outcome,
      startedAt: startedAt ?? null,
      finishedAt: now,
      elapsedMs,
      memoryAtStart,
      memoryAtFinish,
      memoryDelta,
      ...(extra ?? {}),
    });
  }, [emitBuildSessionTransitionLog]);
  useEffect(() => {
    const wasActive = previousTransitionActiveRef.current;
    if (wasActive && !buildSessionTransition.active) {
      const pendingSteps = Array.from(buildStartupStepStartedAtRef.current.keys());
      pendingSteps.forEach((step) => {
        finishBuildStartupStep(step, 'aborted', {
          reason: 'transition-finished-before-step-completed',
        });
      });
    }
    previousTransitionActiveRef.current = buildSessionTransition.active;
  }, [buildSessionTransition.active, finishBuildStartupStep]);
  const refreshSessionRecord = useCallback(async () => {
    if (!activeNodeId) {
      setSessionRecord(null);
      return null;
    }
    const next = await shapeQueryAPIImpl.getBuildSessionRecord(activeNodeId).catch(() => null);
    setSessionRecord(next);
    return next;
  }, [activeNodeId]);

  const updateSessionRecord = useCallback(async (patch: Partial<ShapeBuildSessionRecord>): Promise<boolean> => {
    if (!activeNodeId) return false;
    if (Object.keys(patch).length === 0) return true;
    try {
      await shapeMutationAPIImpl.updateBuildSession(activeNodeId, patch);
      setSessionRecord((current) => {
        if (!current) return current;
        return {
          ...current,
          ...patch,
          updatedAt: Date.now(),
        };
      });
      return true;
    } catch (error) {
      console.warn('[ShapeBuildProgressStep] failed to update build session record', error);
      return false;
    }
  }, [activeNodeId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await refreshSessionRecord();
      if (cancelled) return;
    };
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshSessionRecord]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!activeNodeId) return;
    const stageId = sessionRecord?.stageId ?? null;
    const status = sessionRecord?.status ?? null;
    const stageHeartbeatAt = sessionRecord?.stageHeartbeatAt ?? null;
    const updatedAt = sessionRecord?.updatedAt ?? null;
    const key = `${String(activeNodeId)}:${status ?? '-'}:${stageId ?? '-'}:${stageHeartbeatAt ?? '-'}`;
    if (lastWorkerStageTraceKeyRef.current === key) return;
    lastWorkerStageTraceKeyRef.current = key;
    console.log('[ShapeBuildWorkerStageTrace]', {
      nodeId: String(activeNodeId),
      status,
      stageId,
      stageHeartbeatAt,
      updatedAt,
    });
  }, [
    activeNodeId,
    sessionRecord?.stageHeartbeatAt,
    sessionRecord?.stageId,
    sessionRecord?.status,
    sessionRecord?.updatedAt,
  ]);

  const { progress, status, error } = useBuildProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const hasNodeId = Boolean(activeNodeId && !error);
  const effectiveProgress = hasNodeId ? progress : null;
  const effectiveStatus = hasNodeId ? status : null;
  const effectiveProgressTraceRef = useRef<string | null>(null);
  const stages = useShapeBuildStages(t);
  const persistedProcessingStatus = sessionRecord ? toProcessingStatus(sessionRecord.status) : null;
  const processingStatus = persistedProcessingStatus ?? 'idle';
  const persistedStageElapsedStageId = typeof sessionRecord?.stageId === 'string'
    ? sessionRecord.stageId
    : null;
  const [timingStageId, setTimingStageId] = useState<string | null>(() => persistedStageElapsedStageId);
  const [displayStageRemainingMs, setDisplayStageRemainingMs] = useState<number | null>(null);
  const stageRemainingTickRef = useRef<number | null>(null);
  const latestStageRemainingMsRef = useRef<number | null>(null);
  const runtimeStatus = status?.status ?? sessionRecord?.status ?? null;
  const stopReason = sessionRecord?.stopReason;
  const statusSource = useMemo(() => {
    return resolveBuildStatusSource(processingStatus, effectiveStatus?.status ?? null);
  }, [effectiveStatus?.status, processingStatus]);
  const isStopRequestedInFlight = isStopRequested || isStopAccepted;
  const isSessionStopping = isStopRequestedInFlight;
  const effectiveStatusSource = useMemo(() => {
    if (isSessionStopping) return 'paused';
    return statusSource;
  }, [isSessionStopping, statusSource]);
  const reportTaskFailures = effectiveStatusSource === 'processing';
  const baseBuildStatus = useMemo<BuildStatus>(() => (
    toBuildStatus(effectiveStatusSource)
  ), [effectiveStatusSource]);
  const { tasks, isLoading: isTasksLoading, isTaskStreamReady, refresh: refreshTasks } = useShapeBuildTasks(activeNodeId, {
    reportFailures: reportTaskFailures,
  });
  const persistedTasks = useAtomValue(persistedTasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);
  const lastPersistedNodeIdRef = useRef<NodeId | null>(null);
  useEffect(() => {
    const currentNodeId = activeNodeId ?? null;
    if (lastPersistedNodeIdRef.current && lastPersistedNodeIdRef.current !== currentNodeId) {
      setPersistedTasks([]);
    }
    lastPersistedNodeIdRef.current = currentNodeId;
  }, [activeNodeId, setPersistedTasks]);
  useEffect(() => {
    if (tasks.length === 0) return;
    setPersistedTasks(tasks);
  }, [setPersistedTasks, tasks]);
  const isTaskSummaryLoading = false;
  const rawDisplayTasks: ShapeBuildTaskSummary[] = tasks.length > 0 ? tasks : persistedTasks;
  const displayTasks = useMemo<ShapeBuildTaskSummary[]>(() => (
    isSessionStopping
      ? rawDisplayTasks.map((task: ShapeBuildTaskSummary) => (
        task.status === 'running'
          ? { ...task, status: 'queued' }
          : task
      ))
      : rawDisplayTasks
  ), [isSessionStopping, rawDisplayTasks]);
  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);
  const hasStartedTasks = useMemo(() => (
    displayTasks.some((task) => (
      task.status === 'running'
      || task.status === 'completed'
      || task.status === 'recycled'
      || task.status === 'failed'
    ))
  ), [displayTasks]);
  const hasQueuedTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'queued')
  ), [displayTasks]);
  const taskProgressTotal = effectiveProgress?.total ?? sessionRecord?.progress?.total ?? null;
  const hasProgressTaskSignal = useMemo(() => hasAwaitingFirstTaskSignal({
    hasStartedTasks,
    hasQueuedTasks,
    progressTaskId: effectiveProgress?.progressTaskId ?? null,
    progressTotal: taskProgressTotal,
  }), [
    effectiveProgress?.progressTaskId,
    hasQueuedTasks,
    hasStartedTasks,
    sessionRecord?.progress?.total,
    taskProgressTotal,
  ]);
  const hasFirstTaskSignal = useMemo(() => hasAwaitingFirstTaskSignal({
    hasStartedTasks,
    hasQueuedTasks,
    progressTaskId: effectiveProgress?.progressTaskId ?? null,
    progressTotal: taskProgressTotal,
  }), [
    effectiveProgress?.progressTaskId,
    sessionRecord?.progress?.total,
    hasQueuedTasks,
    hasStartedTasks,
  ]);
  const completedTaskSequenceById = useMemo(() => {
    const map = new Map<string, number>();
    displayTasks.forEach((task) => {
      if (task.status !== 'completed' && task.status !== 'recycled') return;
      if (!(typeof task.sequence === 'number' && Number.isFinite(task.sequence))) return;
      const current = map.get(task.taskId);
      if (current === undefined || task.sequence > current) {
        map.set(task.taskId, task.sequence);
      }
    });
    return map;
  }, [displayTasks]);
  const tasksCompletionStatus = useMemo<BuildStatus | null>(() => {
    if (displayTasks.length === 0) return null;
    if (hasInFlightTasks) return null;
    const hasFailed = displayTasks.some((task) => task.status === 'failed');
    return hasFailed ? 'failed' : 'completed';
  }, [displayTasks, hasInFlightTasks]);
  const buildStatus = useMemo<BuildStatus>(() => resolveDisplayBuildStatus({
    baseBuildStatus,
    tasksCompletionStatus,
    hasInFlightTasks,
  }), [baseBuildStatus, hasInFlightTasks, tasksCompletionStatus]);
  const lastTaskRefreshRef = useRef<{ nodeId: string; at: number } | null>(null);
  useEffect(() => {
    if (!activeNodeId) return;
    const shouldRefresh = shouldRefreshTasksSnapshot({
      displayTaskCount: displayTasks.length,
      hasInFlightTasks,
      hasProgressTaskSignal,
      buildStatus,
      runtimeStatus,
      processingStatus,
      buildSessionTransitionActive: buildSessionTransition.active,
    });
    if (!shouldRefresh) return;
    const now = Date.now();
    const last = lastTaskRefreshRef.current;
    if (last && last.nodeId === String(activeNodeId) && now - last.at < 2000) {
      return;
    }
    lastTaskRefreshRef.current = { nodeId: String(activeNodeId), at: now };
    void refreshTasks();
  }, [
    activeNodeId,
    buildStatus,
    buildSessionTransition.active,
    displayTasks.length,
    hasInFlightTasks,
    hasProgressTaskSignal,
    processingStatus,
    refreshTasks,
    runtimeStatus,
  ]);
  useEffect(() => {
    if (!isShapeProgressStepDebugEnabled()) return;
    const nextTrace: ShapeProgressStepTracePayload = {
      nodeId: activeNodeId,
      phase: buildStatus,
      progressTaskId: effectiveProgress?.progressTaskId ?? null,
      progressTaskStatus: effectiveProgress?.progressTaskStatus ?? null,
      progressTaskStage: effectiveProgress?.progressTaskStage ?? null,
      progressTaskProgress: effectiveProgress?.progressTaskProgress ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      total: effectiveProgress?.total ?? 0,
      completed: effectiveProgress?.completed ?? 0,
      failed: effectiveProgress?.failed ?? 0,
      skipped: effectiveProgress?.skipped ?? 0,
      message: effectiveProgress?.message ?? null,
    };
    const signature = JSON.stringify(nextTrace);
    if (signature === effectiveProgressTraceRef.current) return;
    effectiveProgressTraceRef.current = signature;
    emitShapeProgressStepTrace(nextTrace);
  }, [activeNodeId, buildStatus, effectiveProgress]);

  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const taskType = effectiveProgress?.taskType;
  const liveTaskType = taskType ?? effectiveStatus?.stage;
  const runningStageIdFromTasks = useMemo(() => resolveMostAdvancedRunningStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);
  const inFlightStageIdFromTasks = useMemo(() => resolveMostAdvancedInFlightStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);
  const resolvedTaskType = liveTaskType ?? stages[0]?.id;
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const isElapsedResetState = useMemo(() => shouldResetElapsedState({
    buildStatus,
    buildElapsedMs: sessionRecord?.elapsedMs,
    stageElapsedByStage: persistedStageElapsedByStage,
    localElapsedByStage: completedStageElapsedMs,
  }), [
    buildStatus,
    completedStageElapsedMs,
    sessionRecord?.elapsedMs,
    persistedStageElapsedByStage,
  ]);
  useEffect(() => {
    if (buildStatus === 'idle' || isElapsedResetState) {
      if (timingStageId !== null) {
        setTimingStageId(null);
      }
      return;
    }
    const fallbackStageId = buildStatus === 'running' ? resolvedTaskType : null;
    const nextStageId = runningStageIdFromTasks
      ?? inFlightStageIdFromTasks
      ?? liveTaskType
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
    liveTaskType,
    persistedStageElapsedStageId,
    resolvedTaskType,
    inFlightStageIdFromTasks,
    runningStageIdFromTasks,
    timingStageId,
  ]);

  const stageElapsedMs = timingStageId ? (completedStageElapsedMs[timingStageId] ?? 0) : 0;
  const totalElapsedMs = useMemo(() => (
    sumNumberRecord(completedStageElapsedMs)
  ), [completedStageElapsedMs]);
  useEffect(() => {
    if (isElapsedResetState) {
      if (!shallowEqualNumberRecord(completedStageElapsedMs, {})) {
        setCompletedStageElapsedMs({});
      }
      return;
    }
    const merged = mergeElapsedByStage(completedStageElapsedMs, persistedStageElapsedByStage);
    if (shallowEqualNumberRecord(completedStageElapsedMs, merged)) return;
    setCompletedStageElapsedMs(merged);
  }, [completedStageElapsedMs, isElapsedResetState, persistedStageElapsedByStage]);

  useEffect(() => {
    if (!isElapsedResetState) return;
    setDisplayStageRemainingMs(null);
    stageRemainingTickRef.current = null;
    latestStageRemainingMsRef.current = null;
    lastPersistedStageMapRef.current = null;
    lastPersistedStageIdRef.current = null;
    if (!shallowEqualNumberRecord(completedStageElapsedMs, {})) {
      setCompletedStageElapsedMs({});
    }
    if (timingStageId !== null) {
      setTimingStageId(null);
    }
  }, [completedStageElapsedMs, isElapsedResetState, timingStageId]);

  const isTimingStageRunning = useMemo(() => {
    if (!timingStageId) return false;
    return displayTasks.some((task) => (
      normalizeStageKey(task) === timingStageId
      && task.status === 'running'
    ));
  }, [displayTasks, timingStageId]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (!timingStageId) return;
    if (!isTimingStageRunning) return;
    const intervalId = window.setInterval(() => {
      setCompletedStageElapsedMs((current) => ({
        ...current,
        [timingStageId]: (current[timingStageId] ?? 0) + 1000,
      }));
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [buildStatus, isTimingStageRunning, timingStageId]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (hasPositiveElapsed(persistedStageElapsedByStage)) return;
    if (typeof sessionRecord?.elapsedMs === 'number' && sessionRecord.elapsedMs > 0) return;
    setCompletedStageElapsedMs((current) => (
      shallowEqualNumberRecord(current, {}) ? current : {}
    ));
  }, [buildStatus, persistedStageElapsedByStage, sessionRecord?.elapsedMs]);

  const hasFailedFetchTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && normalizeStageKey(task) === 'fetch')
  ), [displayTasks]);

  const progressSummary = useShapeBuildProgressSummaryComputation({
    stages,
    resolvedTaskType: timingStageId ?? resolvedTaskType,
    overallProgress,
    buildStatus,
    effectiveProgress: effectiveProgress ?? null,
    effectiveStatus: effectiveStatus ?? null,
    taskType,
    tasks: displayTasks,
    normalizeStageKey,
    isSkippedTask: (task: ShapeBuildTaskSummary) => isTaskSkipped(task.display, task.message),
    timingStageMs: stageElapsedMs,
  });
  const displayTotalElapsedMs = totalElapsedMs;
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
    resolvedTaskType: timingStageId ?? resolvedTaskType,
    displayStageId: progressSummary.displayStageId,
    rawDisplayCounts: progressSummary.rawDisplayCounts,
  });

  const isProcessingValid = useMemo(() => {
    if (!data?.buildConfig) return false;
    return validateBatchConfig(
      data.buildConfig,
      data.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
    ).isValid;
  }, [data?.buildConfig, data?.processingConfig]);

  const showResumeLabel = useMemo(() => (
    buildStatus === 'paused' || (!buildSessionTransition.active && displayTasks.length > 0)
  ), [buildStatus, displayTasks.length, buildSessionTransition.active]);
  const hasSelection = summarizeCheckboxState(selectedArrayByCountries).hasSelection;
  const hasDataSource = Boolean(data?.buildConfig?.dataSourceName);
  const bridgeRef = useRef(getBuildWorkerBridge());
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const authDialogOpen = false;
  const closeAuthDialog = useCallback(() => {}, []);
  const handleProviderSelect = useCallback((_provider: AuthProviderType) => {}, []);
  const saveDraftBeforeBuild = useCallback(async (patch?: Partial<ShapeEntity>) => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return false;
    }
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      const node = await updater.getTreeNode(activeNodeId);
      const currentDraftData = (
        node?.draftData && typeof node.draftData === 'object'
          ? (node.draftData as Record<string, unknown>)
          : {}
      );
      await updater.updateTreeNode(activeNodeId, {
        mode: 'save-draft',
        draftData: createBuildStartDraftData({
          currentDraftData,
          liveData: data,
          patch,
        }),
      });
      return true;
    } catch (error) {
      notify.error('Failed to save draft.');
      console.error('[ShapeBuildProgressStep] save draft failed', error);
      return false;
    }
  }, [activeNodeId, data, workerClient]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (isElapsedResetState) {
      lastPersistedStageMapRef.current = null;
      lastPersistedStageIdRef.current = null;
      return;
    }
    const merged = mergeElapsedByStage(completedStageElapsedMs, persistedStageElapsedByStage);
    if (!shallowEqualNumberRecord(completedStageElapsedMs, merged)) {
      setCompletedStageElapsedMs(merged);
      return;
    }
    const stageId = timingStageId ?? null;
    const mapUnchanged = shallowEqualNumberRecord(completedStageElapsedMs, persistedStageElapsedByStage);
    const stageUnchanged = lastPersistedStageIdRef.current === stageId;
    if (mapUnchanged && stageUnchanged) return;
    if (lastPersistedStageMapRef.current
      && shallowEqualNumberRecord(lastPersistedStageMapRef.current, completedStageElapsedMs)
      && stageUnchanged) {
      return;
    }
    lastPersistedStageMapRef.current = completedStageElapsedMs;
    lastPersistedStageIdRef.current = stageId;
    void updateSessionRecord({
      elapsedByStage: completedStageElapsedMs,
      elapsedMs: totalElapsedMs,
      stageId: stageId ?? undefined,
    });
  }, [
    activeNodeId,
    completedStageElapsedMs,
    isElapsedResetState,
    persistedStageElapsedByStage,
    timingStageId,
    totalElapsedMs,
    updateSessionRecord,
  ]);

  useEffect(() => {
    const progressMessage = typeof effectiveProgress?.message === 'string'
      ? effectiveProgress.message.trim()
      : '';
    const progressDisplay = effectiveProgress?.progressTaskDisplay;
    if (!progressDisplay && !progressMessage) return;
    if (!buildSessionTransition.active && buildStatus !== 'running' && runtimeStatus !== 'processing') return;
    const progressTaskId = effectiveProgress?.progressTaskId;
    const progressTaskSequence = effectiveProgress?.progressTaskSequence;
    const progressTaskStatus = effectiveProgress?.progressTaskStatus;
    const progressTaskTitle = typeof effectiveProgress?.progressTaskTitle === 'string'
      ? effectiveProgress.progressTaskTitle.trim()
      : '';
    const canCheckStale = (
      typeof progressTaskId === 'string'
      && typeof progressTaskSequence === 'number'
      && Number.isFinite(progressTaskSequence)
      && (progressTaskStatus === 'running' || progressTaskStatus === 'queued')
    );
    if (canCheckStale) {
      const completedSequence = completedTaskSequenceById.get(progressTaskId);
      if (typeof completedSequence === 'number' && completedSequence >= progressTaskSequence) {
        return;
      }
    }
    const isPhaseMessage = isTaskPhaseDisplay(progressDisplay);
    const isTerminalUpdate = (
      progressTaskStatus === 'completed'
      || ((effectiveProgress?.percentage ?? 0) >= 100 && !isPhaseMessage)
    );
    if (!isTerminalUpdate) return;
    const key = `${progressTaskId ?? ''}:${progressTaskSequence ?? ''}:${progressTaskStatus ?? ''}:${progressDisplay?.kind ?? ''}:${progressDisplay?.key ?? ''}:${progressMessage}`;
    if (progressTerminalLogKeyRef.current === key) return;
    progressTerminalLogKeyRef.current = key;
    emitBuildSessionTransitionLog('info', 'worker progress terminal update', {
      stage: resolvedTaskType ?? null,
      message: progressMessage || null,
      displayKind: progressDisplay?.kind ?? null,
      displayKey: progressDisplay?.key ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      taskId: progressTaskId ?? null,
      taskTitle: progressTaskTitle || null,
      taskSequence: progressTaskSequence ?? null,
      taskStatus: progressTaskStatus ?? null,
    });
  }, [
    buildStatus,
    effectiveProgress?.message,
    effectiveProgress?.percentage,
    effectiveProgress?.progressTaskDisplay,
    effectiveProgress?.progressTaskId,
    effectiveProgress?.progressTaskSequence,
    effectiveProgress?.progressTaskStatus,
    effectiveProgress?.progressTaskTitle,
    emitBuildSessionTransitionLog,
    completedTaskSequenceById,
    resolvedTaskType,
    runtimeStatus,
    buildSessionTransition.active,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active) {
      setBuildSessionTransitionElapsedMs(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - buildSessionTransition.startedAt;
      setBuildSessionTransitionElapsedMs(elapsedMs);
      const watchdogEvent = resolveStartupTransitionWatchdogEvent({
        elapsedMs,
        warnStep: buildSessionTransitionWarnStepRef.current,
      });
      if (watchdogEvent.kind === 'none') {
        return;
      }
      buildSessionTransitionWarnStepRef.current = watchdogEvent.nextWarnStep;
      if (watchdogEvent.kind === 'timeout') {
        emitBuildSessionTransitionLog('error', 'build session transition timeout', {
          phase: buildSessionTransition.phase,
          elapsedMs,
        });
        if (buildSessionTransition.phase === 'awaiting-first-task') {
          finishBuildStartupStep('awaiting-first-task', 'error', {
            reason: 'timeout-before-task-start',
            elapsedMs,
          });
        }
        finishBuildSessionTransition({
          level: 'error',
          message: `Build did not start task processing (${buildSessionTransition.phase}, ${Math.round(elapsedMs / 1000)}s).`,
        });
        return;
      }
      if (watchdogEvent.kind === 'long-wait') {
        emitBuildSessionTransitionLog('warn', 'build session transition long wait', {
          phase: buildSessionTransition.phase,
          elapsedMs,
        });
        pushBuildSessionTransitionNotification(
          'warning',
          `Build start is still waiting at "${buildSessionTransition.phase}".`,
        );
        return;
      }
      if (watchdogEvent.kind === 'wait') {
        emitBuildSessionTransitionLog('info', 'build session transition wait', {
          phase: buildSessionTransition.phase,
          elapsedMs,
        });
        pushBuildSessionTransitionNotification(
          'info',
          `Build start is taking longer than expected (${buildSessionTransition.phase}).`,
        );
      }
    }, 1000);
    setBuildSessionTransitionElapsedMs(Math.max(0, Date.now() - buildSessionTransition.startedAt));
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    emitBuildSessionTransitionLog,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    pushBuildSessionTransitionNotification,
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransition.startedAt,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active || buildSessionTransition.phase !== 'waiting-lock') {
      buildSessionTransitionWaitLogStepRef.current = -1;
      return;
    }
    const intervalMs = UI_POLL_INTERVAL_MS;
    const tick = () => {
      const elapsedMs = Date.now() - buildSessionTransition.startedAt;
      const nextStep = Math.floor(elapsedMs / intervalMs);
      if (nextStep <= buildSessionTransitionWaitLogStepRef.current) return;
      buildSessionTransitionWaitLogStepRef.current = nextStep;
      emitBuildSessionTransitionLog('info', 'build session waiting for lock', {
        phase: buildSessionTransition.phase,
        elapsedMs,
        pollIntervalMs: intervalMs,
      });
    };
    tick();
    const intervalId = window.setInterval(tick, intervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    emitBuildSessionTransitionLog,
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransition.startedAt,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active) return;
    if (buildSessionTransition.phase !== 'awaiting-first-task') return;
    const decisionInput = {
      hasFirstTaskSignal,
      hasStartedTasks,
      hasProgressTaskSignal,
      buildStatus,
      taskCount: isTaskStreamReady ? displayTasks.length : undefined,
      isTaskStreamReady,
      expectTaskGeneration: awaitingFirstTaskExpectationRef.current,
      sessionProgressTotal: sessionRecord?.progress?.total,
      sessionStageId: sessionRecord?.stageId ?? null,
    };
    const decisionTraceKey = import.meta.env.DEV
      ? JSON.stringify({
        phase: buildSessionTransition.phase,
        buildStatus: decisionInput.buildStatus,
        hasFirstTaskSignal: decisionInput.hasFirstTaskSignal,
        hasStartedTasks: decisionInput.hasStartedTasks,
        hasProgressTaskSignal: decisionInput.hasProgressTaskSignal,
        taskCount: decisionInput.taskCount,
        isTaskStreamReady: decisionInput.isTaskStreamReady,
        expectTaskGeneration: decisionInput.expectTaskGeneration,
        sessionProgressTotal: decisionInput.sessionProgressTotal ?? null,
        sessionStageId: decisionInput.sessionStageId ?? null,
      })
      : null;
    if (decisionTraceKey && lastAwaitingFirstTaskDecisionTraceKeyRef.current !== decisionTraceKey) {
      lastAwaitingFirstTaskDecisionTraceKeyRef.current = decisionTraceKey;
      console.log('[ShapeAwaitingFirstTaskDecisionTrace] input', JSON.stringify({
        nodeId: activeNodeId ? String(activeNodeId) : null,
        ...decisionInput,
      }));
    }
    const decision = resolveAwaitingFirstTaskDecision({
      ...decisionInput,
    });
    if (import.meta.env.DEV && decision.kind !== 'continue') {
      console.log('[ShapeAwaitingFirstTaskDecisionTrace] decision', JSON.stringify({
        nodeId: activeNodeId ? String(activeNodeId) : null,
        decision,
      }));
    }
    if (decision.kind === 'continue') return;

    if (decision.kind === 'success') {
      if (decision.taskExecutionStarted && !buildSessionTransitionTaskStartNotifiedRef.current) {
        buildSessionTransitionTaskStartNotifiedRef.current = true;
        emitBuildSessionTransitionLog('info', 'task execution started', {
          tasks: displayTasks.length,
          queuedOnly: decision.taskExecutionStarted.queuedOnly,
          hasProgressTaskSignal: decision.taskExecutionStarted.hasProgressTaskSignal,
        });
        if (decision.notification) {
          pushBuildSessionTransitionNotification(decision.notification.level, decision.notification.message);
        }
      }
      finishBuildStartupStep('awaiting-first-task', 'success', {
        reason: decision.reason,
        tasks: displayTasks.length,
        hasProgressTaskSignal,
      });
      if (decision.transitionFinish) {
        finishBuildSessionTransition(decision.transitionFinish);
      } else {
        finishBuildSessionTransition();
      }
      return;
    }

    if (decision.kind === 'error') {
      finishBuildStartupStep('awaiting-first-task', 'error', {
        reason: decision.reason,
      });
      finishBuildSessionTransition(decision.transitionFinish);
      return;
    }

    finishBuildStartupStep('awaiting-first-task', 'cancelled', {
      reason: decision.reason,
    });
    finishBuildSessionTransition(decision.transitionFinish);
  }, [
    activeNodeId,
    buildStatus,
    displayTasks.length,
    emitBuildSessionTransitionLog,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    hasFirstTaskSignal,
    hasProgressTaskSignal,
    hasStartedTasks,
    isStopRequestedInFlight,
    isTaskStreamReady,
    pushBuildSessionTransitionNotification,
    sessionRecord?.progress?.total,
    buildSessionTransition.active,
    buildSessionTransition.phase,
  ]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (buildSessionTransition.active) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const shouldMonitor = sessionRecord?.status === 'running' && !sessionRecord?.completedAt;
    if (!shouldMonitor) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    if (buildStatus === 'running' || runtimeStatus === 'processing') {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const now = Date.now();
    const elapsedSinceStart = now - crashCheckStartedAtRef.current;
    if (elapsedSinceStart < UI_QUIET_THRESHOLD_MS) return;
    const stageHeartbeatAt = sessionRecord?.stageHeartbeatAt ?? sessionRecord?.updatedAt ?? null;
    const suspectWindowMs = UI_QUIET_THRESHOLD_MS + UI_POLL_INTERVAL_MS * 2;
    if (stageHeartbeatAt && now - stageHeartbeatAt <= suspectWindowMs) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    if (suspendSuspectOpen) {
      closeSuspendSuspect();
    }
    if (!crashSuspectOpen) {
      setCrashSuspectMessage(
        t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
      );
      setCrashSuspectOpen(true);
    }
  }, [
    activeNodeId,
    buildStatus,
    closeCrashSuspect,
    closeSuspendSuspect,
    crashSuspectOpen,
    runtimeStatus,
    sessionRecord?.completedAt,
    sessionRecord?.stageHeartbeatAt,
    sessionRecord?.status,
    sessionRecord?.updatedAt,
    buildSessionTransition.active,
    suspendSuspectOpen,
    t,
  ]);

  const {
    handleStartOrResume,
    handlePause,
  } = useShapeBuildStepControlActions({
    activeNodeId,
    data,
    buildStatus,
    runtimeStatus,
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
    saveDraftBeforeBuild,
    refreshTasks,
    updateSessionRecord,
    setIsStopRequested,
    setIsStopAccepted,
  });

  useEffect(() => {
    if (!isStopRequestedInFlight) return;
    if (sessionRecord?.status === 'idle' || sessionRecord?.status === 'paused') {
      setIsStopRequested(false);
      setIsStopAccepted(false);
    }
  }, [isStopRequestedInFlight, sessionRecord?.status]);
  const { canStartOrResume, isStartPending, startOrResume, clearStartPending } = useShapeBuildAutoResume({
    activeNodeId,
    buildStatus,
    stopReason,
    runtimeStatus,
    handleStartOrResume,
    handlePause,
    hasFailedFetchTasks,
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
    ? getBuildSessionTransitionStatusLabel(t, buildSessionTransition.phase, buildSessionTransitionElapsedMs)
    : isStartPending && buildStatus === 'idle'
      ? t('stage.status.starting', 'Starting stage...')
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
    stageTotals: progressSummary.stageTotals,
    timingStageId,
    completedStageElapsedMs,
    warningMessage,
    showResumeLabel,
    canStartOrResume,
    handleStartOrResume: startOrResume,
    handlePause,
    isStartPending,
    stopRequested: isStopRequestedInFlight,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
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
