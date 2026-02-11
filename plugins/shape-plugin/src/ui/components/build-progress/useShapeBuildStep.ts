import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  createPollingTracker,
  createSessionCoordinator,
  type SessionChannelMessage,
  type SessionLockHandle,
} from '@hierarchidb/session-coordinator';
import { useShapeBuildTasks } from './useShapeBuildTasks.ts';
import { useBuildProgress } from './useBuildProgress.js';
import { useTranslation } from '../../i18n.js';
import {
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '../../../common/types/index.js';
import {
  executePauseBuildFlow,
  useBuildSessionTransition,
  type BuildSessionTransitionNotificationLevel,
} from '@hierarchidb/components/build-session';
import { notify } from '@hierarchidb/components/notify';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import { isTaskPhaseDisplay, isTaskSkipped } from '../../../common/utils/taskMessages.ts';
import { getMemorySnapshot } from '@hierarchidb/ui-monitoring';
import { useShapeBuildAutoResume } from './useShapeBuildAutoResume.ts';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { loadTreeConsoleSettings } from '@hierarchidb/util';
import type { AuthProviderType } from '@hierarchidb/ui-auth';
import { useShapeBuildStages } from './useShapeBuildStages.ts';
import { useShapeBuildProgressSummary } from './useShapeBuildProgressSummary.ts';
import { useShapeBuildLabels } from './useShapeBuildLabels.ts';
import type { BuildProgress, BuildProgressStatus } from './shapeBuildProgressMapping.ts';
import { resolveBuildStatusSource } from './resolveBuildStatusSource.ts';
import { shouldResumeBuildSession } from './shouldResumeBuildSession.ts';
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
type StageLikeTask = {
  taskType?: TaskStage;
  type?: TaskStage;
  stage: TaskStage;
};

const shallowEqualNumberRecord = (left: Record<string, number>, right: Record<string, number>): boolean => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const sumNumberRecord = (values: Record<string, number>): number => (
  Object.values(values).reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0)
);

const mergeElapsedByStage = (
  current: Record<string, number>,
  persisted: Record<string, number>,
): Record<string, number> => {
  const next: Record<string, number> = { ...current };
  Object.entries(persisted).forEach(([stageId, persistedMs]) => {
    if (!Number.isFinite(persistedMs) || persistedMs < 0) return;
    const currentMs = next[stageId] ?? 0;
    if (persistedMs > currentMs) {
      next[stageId] = persistedMs;
    }
  });
  return next;
};

const shouldResetElapsedState = (params: {
  buildStatus: BuildStatus;
  buildElapsedMs: number | undefined;
  stageElapsedByStage: Record<string, number>;
}): boolean => {
  if (params.buildStatus === 'running') return false;
  if (!shallowEqualNumberRecord(params.stageElapsedByStage, {})) return false;
  if (typeof params.buildElapsedMs === 'number' && params.buildElapsedMs > 0) return false;
  return true;
};

const normalizeStageKey = (task: StageLikeTask): TaskStage => task.taskType ?? task.type ?? task.stage;

const toBuildStatus = (status?: string | null): BuildStatus => {
  switch (status) {
    case 'processing':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

const toProcessingStatus = (status?: string | null): 'idle' | 'processing' | 'paused' | 'completed' | 'failed' => {
  switch (status) {
    case 'running':
    case 'processing':
      return 'processing';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
};

const summarizeSelectedEntries = (
  selectedArrayByCountries: ShapeEntity['selectedArrayByCountries'] | null | undefined,
): { selectedCountryCount: number; selectedAdminPairCount: number } => {
  if (!selectedArrayByCountries || typeof selectedArrayByCountries !== 'object' || Array.isArray(selectedArrayByCountries)) {
    return { selectedCountryCount: 0, selectedAdminPairCount: 0 };
  }
  let selectedCountryCount = 0;
  let selectedAdminPairCount = 0;
  Object.values(selectedArrayByCountries).forEach((row) => {
    if (!Array.isArray(row)) return;
    let hasSelectedInCountry = false;
    row.forEach((selected) => {
      if (selected) {
        hasSelectedInCountry = true;
        selectedAdminPairCount += 1;
      }
    });
    if (hasSelectedInCountry) {
      selectedCountryCount += 1;
    }
  });
  return { selectedCountryCount, selectedAdminPairCount };
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

const START_DIAGNOSTIC_WARN_MS = 10_000;
const START_DIAGNOSTIC_LONG_WAIT_MS = 20_000;
const START_DIAGNOSTIC_TIMEOUT_MS = 45_000;

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

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
  const coordinator = useMemo(() => (
    createSessionCoordinator({
      channelName: 'sessions',
      pollIntervalTimeout: 3000,
      quietThresholdTimeout: 5000,
    })
  ), []);
  const activeNodeId = nodeId ?? null;
  const lockKey = useMemo(() => (
    activeNodeId ? `shape:${activeNodeId}` : null
  ), [activeNodeId]);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastAtRef = useRef<number | null>(null);
  const lastBroadcastTabIdRef = useRef<string | null>(null);
  const lastAckAtRef = useRef<number | null>(null);
  const lastAckTabIdRef = useRef<string | null>(null);
  const lockRef = useRef<SessionLockHandle | null>(null);
  const lockKeyRef = useRef<string | null>(null);
  const [isLockOwner, setIsLockOwner] = useState(false);

  const releaseBuildLock = useCallback(() => {
    const lock = lockRef.current;
    if (!lock) return;
    lock.release();
    lockRef.current = null;
    lockKeyRef.current = null;
    setIsLockOwner(false);
  }, []);

  const tryAcquireBuildLock = useCallback(async (options?: { notifyOnFailure?: boolean }): Promise<boolean> => {
    if (!lockKey) return false;
    if (lockRef.current) return true;
    const lock = await coordinator.tryAcquireSessionLock(lockKey);
    if (!lock) {
      if (options?.notifyOnFailure) {
        if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
          notify.error('Web Locks API is unavailable.');
        } else {
          notify.info('Build is queued and will start after the current session finishes.');
        }
      }
      return false;
    }
    lockRef.current = lock;
    lockKeyRef.current = lockKey;
    setIsLockOwner(true);
    return true;
  }, [coordinator, lockKey]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForBuildLock = useCallback(async (_requestedAt: number): Promise<boolean> => {
    if (!lockKey || !activeNodeId) return false;
    const pollInterval = coordinator.pollIntervalTimeout;
    while (true) {
      const lock = await coordinator.tryAcquireSessionLock(lockKey);
      if (lock) {
        lockRef.current = lock;
        lockKeyRef.current = lockKey;
        setIsLockOwner(true);
        return true;
      }
      await sleep(pollInterval);
    }
  }, [activeNodeId, coordinator, lockKey]);
  const tabStateRef = useRef<Map<string, { state: 'active' | 'hidden' | 'frozen'; at: number }>>(new Map());
  const pollingTrackerRef = useRef(createPollingTracker({ quietThresholdTimeout: coordinator.quietThresholdTimeout }));
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;

  const [isPausePending, setIsPausePending] = useState(false);
  const clearStartPendingRef = useRef<(() => void) | null>(null);
  const buildSessionTransitionWarnStepRef = useRef<0 | 1 | 2 | 3>(0);
  const buildSessionTransitionTaskStartNotifiedRef = useRef(false);
  const buildSessionTransitionWaitLogStepRef = useRef(-1);
  const buildStartupStepStartedAtRef = useRef<Map<BuildStartupStep, number>>(new Map());
  const buildStartupStepMemoryAtStartRef = useRef<Map<BuildStartupStep, StartupStepMemorySnapshot>>(new Map());
  const previousTransitionActiveRef = useRef(false);
  const progressTerminalLogKeyRef = useRef<string | null>(null);
  const staleProgressLogKeyRef = useRef<string | null>(null);
  const [buildSessionTransitionElapsedMs, setBuildSessionTransitionElapsedMs] = useState(0);
  const [remoteProgress, setRemoteProgress] = useState<BuildProgress | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<BuildProgressStatus | null>(null);
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<number | null>(null);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
  const [sessionRecord, setSessionRecord] = useState<ShapeBuildSessionRecord | null>(null);
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
    progressTerminalLogKeyRef.current = null;
    staleProgressLogKeyRef.current = null;
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
    staleProgressLogKeyRef.current = null;
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
  const getRecentNonActiveState = useCallback((referenceTime: number) => {
    let latest: { state: 'active' | 'hidden' | 'frozen'; at: number } | null = null;
    for (const entry of tabStateRef.current.values()) {
      if (entry.state === 'active') continue;
      if (!latest || entry.at > latest.at) {
        latest = entry;
      }
    }
    if (!latest) return null;
    if (referenceTime - latest.at > suspendTimeout) return null;
    return latest;
  }, [suspendTimeout]);

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

  const { progress, status, error } = useBuildProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const hasNodeId = Boolean(activeNodeId && !error);
  const remoteFresh = Boolean(remoteUpdatedAt && Date.now() - remoteUpdatedAt <= coordinator.quietThresholdTimeout);
  const effectiveProgress = hasNodeId ? (progress ?? (remoteFresh ? remoteProgress : null)) : null;
  const effectiveStatus = hasNodeId ? (status ?? (remoteFresh ? remoteStatus : null)) : null;
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
  const statusSource = useMemo(() => {
    return resolveBuildStatusSource(processingStatus, effectiveStatus?.status ?? null);
  }, [effectiveStatus?.status, processingStatus]);
  const reportTaskFailures = statusSource === 'processing';
  const baseBuildStatus = useMemo<BuildStatus>(() => (
    toBuildStatus(statusSource)
  ), [statusSource]);
  const { tasks, isLoading: isTasksLoading } = useShapeBuildTasks(activeNodeId, {
    reportFailures: reportTaskFailures,
  });
  const isTaskSummaryLoading = false;
  const displayTasks = tasks;
  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);
  const hasStartedTasks = useMemo(() => (
    displayTasks.some((task) => (
      task.status === 'running'
      || task.status === 'completed'
      || task.status === 'failed'
      || task.status === 'regression'
      || task.status === 'warning'
    ))
  ), [displayTasks]);
  const completedTaskSequenceById = useMemo(() => {
    const map = new Map<string, number>();
    displayTasks.forEach((task) => {
      if (task.status !== 'completed') return;
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
  const buildStatus = useMemo<BuildStatus>(() => {
    if (tasksCompletionStatus === 'failed') {
      return 'failed';
    }
    if (tasksCompletionStatus === 'completed') {
      return baseBuildStatus === 'paused' ? 'paused' : 'completed';
    }
    if (baseBuildStatus === 'paused') {
      return 'paused';
    }
    if (hasInFlightTasks) {
      return 'running';
    }
    return baseBuildStatus;
  }, [baseBuildStatus, hasInFlightTasks, tasksCompletionStatus]);

  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const taskType = effectiveProgress?.taskType;
  const liveTaskType = taskType ?? effectiveStatus?.stage;
  const resolvedTaskType = liveTaskType ?? stages[0]?.id;
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const isElapsedResetState = useMemo(() => shouldResetElapsedState({
    buildStatus,
    buildElapsedMs: sessionRecord?.elapsedMs,
    stageElapsedByStage: persistedStageElapsedByStage,
  }), [
    buildStatus,
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
    const nextStageId = liveTaskType ?? timingStageId ?? persistedStageElapsedStageId ?? fallbackStageId ?? null;
    if (nextStageId && nextStageId !== timingStageId) {
      setTimingStageId(nextStageId);
    }
  }, [
    buildStatus,
    isElapsedResetState,
    liveTaskType,
    persistedStageElapsedStageId,
    resolvedTaskType,
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

  const hasFailedFetchTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && normalizeStageKey(task) === 'fetch')
  ), [displayTasks]);

  const progressSummary = useShapeBuildProgressSummary({
    stages,
    resolvedTaskType: timingStageId ?? resolvedTaskType,
    overallProgress,
    buildStatus,
    effectiveProgress: effectiveProgress ?? null,
    effectiveStatus: effectiveStatus ?? null,
    taskType,
    tasks: displayTasks,
    normalizeStageKey,
    isSkippedTask: (task) => isTaskSkipped(task.display, task.message),
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
    resolvedTaskType,
    displayStageId: progressSummary.displayStageId,
    rawDisplayCounts: progressSummary.rawDisplayCounts,
  });

  const isProcessingValid = useMemo(() => {
    if (!data?.buildConfig) return false;
    return validateBatchConfig(data.buildConfig).isValid;
  }, [data?.buildConfig]);

  const showResumeLabel = useMemo(() => (
    buildStatus === 'paused' || (!buildSessionTransition.active && displayTasks.length > 0)
  ), [buildStatus, displayTasks.length, buildSessionTransition.active]);
  const hasSelection = summarizeCheckboxState(selectedArrayByCountries).hasSelection;
  const hasDataSource = Boolean(data?.buildConfig?.dataSourceName);
  const bridgeRef = useRef(getWorkerBridge());
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
  const sendAck = useCallback((sessionId: string, receivedTabId: string) => {
    const channel = channelRef.current;
    if (!channel) return;
    coordinator.sendAck(channel, sessionId, receivedTabId);
  }, [coordinator]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (buildStatus !== 'running' && runtimeStatus !== 'processing') return;
    const activeSessionId = coordinator.readActiveSessionId();
    if (!activeSessionId) {
      coordinator.writeActiveSessionId(String(activeNodeId));
    }
  }, [activeNodeId, buildStatus, coordinator, runtimeStatus]);

  useEffect(() => {
    if (!lockKeyRef.current) return;
    if (lockKeyRef.current === lockKey) return;
    releaseBuildLock();
  }, [lockKey, releaseBuildLock]);

  useEffect(() => {
    return () => {
      releaseBuildLock();
    };
  }, [releaseBuildLock]);

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
      const persistedBuildConfig = (
        currentDraftData.buildConfig && typeof currentDraftData.buildConfig === 'object'
          ? (currentDraftData.buildConfig as Record<string, unknown>)
          : {}
      );
      const nextBuildConfig = {
        ...persistedBuildConfig,
        ...(data?.buildConfig ?? {}),
        ...(patch?.buildConfig ?? {}),
      };
      await updater.updateTreeNode(activeNodeId, {
        mode: 'save-draft',
        draftData: {
          ...sanitizeShapeDraftData(currentDraftData),
          ...sanitizeShapeDraftData(patch ?? {}),
          buildConfig: nextBuildConfig,
        } as Record<string, unknown>,
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

  const maybeAutoResume = useCallback(async () => {
    if (!activeNodeId) return;
    if (buildStatus === 'running' || runtimeStatus === 'processing') return;
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) return;
    const recentNonActive = getRecentNonActiveState(now);
    if (recentNonActive) return;
    const lastBroadcast = lastBroadcastAtRef.current;
    if (lastBroadcast && now - lastBroadcast < coordinator.quietThresholdTimeout) return;
    const candidates = pollingTrackerRef.current.candidates(now);
    if (candidates.length === 0) return;
    if (candidates[0] !== tabIdRef.current) return;
    const lastAutoResumeAt = lastAutoResumeAtRef.current;
    if (lastAutoResumeAt && now - lastAutoResumeAt < coordinator.quietThresholdTimeout) return;
    const acquired = await tryAcquireBuildLock();
    if (!acquired) return;
    lastAutoResumeAtRef.current = now;
    coordinator.writeActiveSessionId(String(activeNodeId));
    try {
      await bridgeRef.current.initialize();
      const status = await bridgeRef.current.getBuildSessionStatus(SHAPE_NODE_TYPE, activeNodeId);
      if (status.status !== 'running') {
        releaseBuildLock();
        return;
      }
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      await bridgeRef.current.resumeBuildSession(SHAPE_NODE_TYPE, activeNodeId, policy);
      await updateSessionRecord({ status: 'running', stopReason: undefined, canResume: false });
    } catch (error) {
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      notify.error('Failed to auto-resume build.');
      console.error('[ShapeBuildProgressStep] auto-resume failed', error);
    }
  }, [
    activeNodeId,
    buildStatus,
    coordinator,
    getRecentNonActiveState,
    releaseBuildLock,
    runtimeStatus,
    tryAcquireBuildLock,
    updateSessionRecord,
  ]);

  useEffect(() => {
    if (!activeNodeId || typeof BroadcastChannel === 'undefined') return;
    const channel = coordinator.openChannel();
    channelRef.current = channel;
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!coordinator.isSessionChannelMessage(message)) return;
      const typedMessage = message as SessionChannelMessage<BuildProgressStatus, BuildProgress>;
      if (typedMessage.sessionId !== String(activeNodeId)) return;
      if (typedMessage.tabId === tabIdRef.current) return;
      const now = Date.now();
      if (typedMessage.type === 'broadcast') {
        lastBroadcastAtRef.current = now;
        lastBroadcastTabIdRef.current = typedMessage.tabId;
        setRemoteProgress(typedMessage.progress ?? null);
        setRemoteStatus(typedMessage.status ?? null);
        setRemoteUpdatedAt(now);
        sendAck(typedMessage.sessionId, typedMessage.tabId);
        return;
      }
      if (typedMessage.type === 'poll') {
        pollingTrackerRef.current.record(typedMessage.tabId, now);
        sendAck(typedMessage.sessionId, typedMessage.tabId);
      }
      if (typedMessage.type === 'tab-state') {
        if (!typedMessage.tabState) return;
        tabStateRef.current.set(typedMessage.tabId, { state: typedMessage.tabState, at: now });
        sendAck(typedMessage.sessionId, typedMessage.tabId);
      }
      if (typedMessage.type === 'ack' && typedMessage.receivedTabId === tabIdRef.current) {
        lastAckAtRef.current = now;
        lastAckTabIdRef.current = typedMessage.tabId;
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [activeNodeId, coordinator, sendAck]);

  useEffect(() => {
    if (!activeNodeId || typeof BroadcastChannel === 'undefined') return;
    const channel = channelRef.current;
    if (!channel) return;
    const sendTabState = (state: 'active' | 'hidden' | 'frozen') => {
      coordinator.sendTabState(channel, String(activeNodeId), state);
    };
    const handleVisibility = () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      sendTabState(isHidden ? 'hidden' : 'active');
    };
    const handlePageHide = () => {
      sendTabState('frozen');
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [activeNodeId, coordinator]);

  useEffect(() => {
    if (!activeNodeId || typeof BroadcastChannel === 'undefined') return;
    const channel = channelRef.current;
    if (!channel) return;
    const tick = () => {
      const now = Date.now();
      pollingTrackerRef.current.record(tabIdRef.current, now);
      coordinator.sendPoll(channel, String(activeNodeId), now);
      if (remoteUpdatedAt && now - remoteUpdatedAt > coordinator.quietThresholdTimeout) {
        setRemoteProgress(null);
        setRemoteStatus(null);
        setRemoteUpdatedAt(null);
      }
      void maybeAutoResume();
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [activeNodeId, coordinator, maybeAutoResume, remoteUpdatedAt]);

  useEffect(() => {
    if (!activeNodeId || typeof BroadcastChannel === 'undefined') return;
    if (buildStatus !== 'running') return;
    if (!isLockOwner) return;
    const channel = channelRef.current;
    if (!channel) return;
    const tick = () => {
      const now = Date.now();
      const activeSessionId = coordinator.readActiveSessionId();
      if (activeSessionId !== String(activeNodeId)) return;
      coordinator.sendBroadcast(channel, String(activeNodeId), status ?? null, progress ?? null, now);
      lastBroadcastAtRef.current = now;
      lastBroadcastTabIdRef.current = tabIdRef.current;
      coordinator.writeBroadcastAt(now);
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [activeNodeId, buildStatus, coordinator, isLockOwner, progress, status]);

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
        const staleKey = `${progressTaskId}:${progressTaskSequence}:${completedSequence}:${progressTaskStatus ?? ''}:${progressDisplay?.kind ?? ''}:${progressDisplay?.key ?? ''}:${progressMessage}`;
        if (staleProgressLogKeyRef.current !== staleKey) {
          staleProgressLogKeyRef.current = staleKey;
          emitBuildSessionTransitionLog('warn', 'ignored stale worker progress update after completion', {
            stage: resolvedTaskType ?? null,
            taskId: progressTaskId,
            taskTitle: progressTaskTitle || null,
            taskSequence: progressTaskSequence,
            completedSequence,
            taskStatus: progressTaskStatus,
            percentage: effectiveProgress?.percentage ?? null,
            message: progressMessage || null,
            displayKind: progressDisplay?.kind ?? null,
            displayKey: progressDisplay?.key ?? null,
          });
        }
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
      if (elapsedMs >= START_DIAGNOSTIC_TIMEOUT_MS && buildSessionTransitionWarnStepRef.current < 3) {
        buildSessionTransitionWarnStepRef.current = 3;
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
      if (elapsedMs >= START_DIAGNOSTIC_LONG_WAIT_MS && buildSessionTransitionWarnStepRef.current < 2) {
        buildSessionTransitionWarnStepRef.current = 2;
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
      if (elapsedMs >= START_DIAGNOSTIC_WARN_MS && buildSessionTransitionWarnStepRef.current < 1) {
        buildSessionTransitionWarnStepRef.current = 1;
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
    const intervalMs = coordinator.pollIntervalTimeout;
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
    coordinator.pollIntervalTimeout,
    emitBuildSessionTransitionLog,
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransition.startedAt,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active) return;
    if (buildSessionTransition.phase !== 'awaiting-first-task') return;
    if (hasStartedTasks) {
      if (!buildSessionTransitionTaskStartNotifiedRef.current) {
        buildSessionTransitionTaskStartNotifiedRef.current = true;
        emitBuildSessionTransitionLog('info', 'task execution started', {
          tasks: displayTasks.length,
        });
        pushBuildSessionTransitionNotification('success', 'Build task execution started.');
      }
      finishBuildStartupStep('awaiting-first-task', 'success', {
        reason: 'task-execution-started',
        tasks: displayTasks.length,
      });
      finishBuildSessionTransition();
      return;
    }
    if (buildStatus === 'completed') {
      finishBuildStartupStep('awaiting-first-task', 'success', {
        reason: displayTasks.length === 0
          ? 'completed-without-generating-tasks'
          : 'completed-before-first-task-update',
        tasks: displayTasks.length,
      });
      if (displayTasks.length === 0) {
        finishBuildSessionTransition({
          level: 'info',
          message: 'Build completed without generating tasks.',
        });
        return;
      }
      finishBuildSessionTransition();
      return;
    }
    if (buildStatus === 'failed') {
      finishBuildStartupStep('awaiting-first-task', 'error', {
        reason: 'failed-before-task-start',
      });
      finishBuildSessionTransition({
        level: 'error',
        message: 'Build failed before task execution started.',
      });
      return;
    }
    if (buildStatus === 'paused' && !isPausePending) {
      finishBuildStartupStep('awaiting-first-task', 'cancelled', {
        reason: 'paused-before-task-start',
      });
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Build paused before task execution started.',
      });
    }
  }, [
    buildStatus,
    displayTasks.length,
    emitBuildSessionTransitionLog,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    hasStartedTasks,
    isPausePending,
    pushBuildSessionTransitionNotification,
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
    if (elapsedSinceStart < coordinator.quietThresholdTimeout) return;
    const lastBroadcast = lastBroadcastAtRef.current;
    const lastAck = lastAckAtRef.current;
    const suspectWindowMs = coordinator.quietThresholdTimeout + coordinator.pollIntervalTimeout * 2;
    const hasRecentBroadcast = lastBroadcast && now - lastBroadcast <= suspectWindowMs;
    const hasRecentAck = lastAck && now - lastAck <= suspectWindowMs;
    if (hasRecentBroadcast || hasRecentAck) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const recentNonActive = getRecentNonActiveState(now);
    if (recentNonActive) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (!suspendSuspectOpen) {
        setSuspendSuspectMessage(
          t('stage.progress.suspendSuspect', 'Build tab is in background; waiting for it to resume.'),
        );
        setSuspendSuspectOpen(true);
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
    coordinator.pollIntervalTimeout,
    coordinator.quietThresholdTimeout,
    crashSuspectOpen,
    getRecentNonActiveState,
    runtimeStatus,
    sessionRecord?.completedAt,
    sessionRecord?.status,
    buildSessionTransition.active,
    suspendSuspectOpen,
    t,
  ]);

  const handleStartOrResume = useCallback(async (options?: { forceRestart?: boolean; autoResume?: boolean }): Promise<boolean> => {
    const requestStartedAt = Date.now();
    const logStartResumeTrace = (event: string, payload?: Record<string, unknown>): void => {
      console.log('[ShapeBuildStartResumeTrace] handleStartOrResume', {
        nodeId: activeNodeId ? String(activeNodeId) : null,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
        event,
        ...(payload ?? {}),
      });
    };
    const runTimedStep = async <T,>(stepName: string, runner: () => Promise<T>): Promise<T> => {
      const stepStartedAt = Date.now();
      logStartResumeTrace(`${stepName}:start`);
      try {
        const result = await runner();
        logStartResumeTrace(`${stepName}:finish`, {
          stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
        });
        return result;
      } catch (error) {
        logStartResumeTrace(`${stepName}:error`, {
          stepElapsedMs: Math.max(0, Date.now() - stepStartedAt),
          errorMessage: getErrorMessage(error),
        });
        throw error;
      }
    };
    logStartResumeTrace('request-received', {
      source: options?.autoResume ? 'auto' : 'manual',
      forceRestart: Boolean(options?.forceRestart),
      buildStatus,
      runtimeStatus,
    });
    if (!activeNodeId) {
      logStartResumeTrace('abort:missing-node-id');
      notify.warning('NodeId is missing.');
      return false;
    }
    const startupSource = options?.autoResume ? 'auto' : 'manual';
    const shouldResumeSession = shouldResumeBuildSession({
      forceRestart: options?.forceRestart,
      buildStatus,
      runtimeStatus,
    });
    beginBuildSessionTransition(
      'acquiring-lock',
      options?.autoResume || shouldResumeSession
        ? 'Resuming build session...'
        : 'Starting build session...',
    );
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) {
      logStartResumeTrace('abort:another-session-active', {
        activeSessionId,
      });
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Another build session is already active in this tab.',
      });
      return false;
    }
    beginBuildStartupStep('lock-acquire', {
      source: startupSource,
      mode: shouldResumeSession ? 'resume' : 'start',
    });
    let acquired = false;
    try {
      acquired = await runTimedStep('lock-acquire', () => tryAcquireBuildLock({ notifyOnFailure: !options?.autoResume }));
      finishBuildStartupStep('lock-acquire', 'success', {
        acquired,
      });
    } catch (error) {
      finishBuildStartupStep('lock-acquire', 'error', {
        errorMessage: getErrorMessage(error),
      });
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to acquire build lock.',
      });
      console.error('[ShapeBuildProgressStep] lock acquire failed', error);
      return false;
    }
    if (!acquired) {
      advanceBuildSessionTransitionPhase('waiting-lock', {
        level: 'info',
        message: 'Waiting for build lock held by another tab...',
      });
      beginBuildStartupStep('lock-wait', {
        source: startupSource,
      });
      let queued = false;
      try {
        queued = await runTimedStep('lock-wait', () => waitForBuildLock(now));
      } catch (error) {
        finishBuildStartupStep('lock-wait', 'error', {
          errorMessage: getErrorMessage(error),
        });
        finishBuildSessionTransition({
          level: 'error',
          message: 'Failed while waiting for build lock.',
        });
        console.error('[ShapeBuildProgressStep] lock wait failed', error);
        return false;
      }
      if (!queued) {
        finishBuildStartupStep('lock-wait', 'cancelled', {
          reason: 'cancelled-while-waiting-lock',
        });
        finishBuildSessionTransition({
          level: 'warning',
          message: 'Build start was cancelled while waiting for lock.',
        });
        return false;
      }
      finishBuildStartupStep('lock-wait', 'success', {
        queued,
      });
    }
    coordinator.writeActiveSessionId(String(activeNodeId));
    advanceBuildSessionTransitionPhase('saving-draft');
    beginBuildStartupStep('draft-save', {
      source: startupSource,
    });
    const saved = await runTimedStep('draft-save', () => saveDraftBeforeBuild());
    if (!saved) {
      finishBuildStartupStep('draft-save', 'error', {
        reason: 'save-draft-returned-false',
      });
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to start build because draft save did not complete.',
      });
      return false;
    }
    finishBuildStartupStep('draft-save', 'success');
    try {
      advanceBuildSessionTransitionPhase('initializing-worker');
      beginBuildStartupStep('worker-initialize', {
        source: startupSource,
      });
      try {
        await runTimedStep('worker-initialize', () => bridgeRef.current.initialize());
        finishBuildStartupStep('worker-initialize', 'success');
      } catch (error) {
        finishBuildStartupStep('worker-initialize', 'error', {
          errorMessage: getErrorMessage(error),
        });
        throw error;
      }
      if (shouldResumeSession) {
        advanceBuildSessionTransitionPhase('starting-session');
        const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
        beginBuildStartupStep('session-resume-request', {
          source: startupSource,
          policy,
        });
        try {
          await runTimedStep('session-resume-request', () => (
            bridgeRef.current.resumeBuildSession(SHAPE_NODE_TYPE, activeNodeId, policy)
          ));
          finishBuildStartupStep('session-resume-request', 'success');
        } catch (error) {
          finishBuildStartupStep('session-resume-request', 'error', {
            errorMessage: getErrorMessage(error),
          });
          throw error;
        }
        emitBuildSessionTransitionLog('info', 'resume session requested', {
          forceRestart: Boolean(options?.forceRestart),
          source: startupSource,
        });
        void updateSessionRecord({ status: 'running', stopReason: undefined, canResume: false });
        advanceBuildSessionTransitionPhase('awaiting-first-task', {
          level: 'info',
          message: 'Build resumed. Waiting for worker task updates...',
        });
        beginBuildStartupStep('awaiting-first-task', {
          source: startupSource,
          mode: 'resume',
        });
        return true;
      }
      advanceBuildSessionTransitionPhase('building-payloads');
      const resolvedDataSource = data?.buildConfig?.dataSourceName;
      const selectionSummary = summarizeSelectedEntries(data?.selectedArrayByCountries);
      beginBuildStartupStep('payload-build', {
        source: startupSource,
        mode: 'worker-side',
        dataSource: resolvedDataSource ?? null,
        selectedCountryCount: selectionSummary.selectedCountryCount,
        selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      });
      if (!resolvedDataSource) {
        finishBuildStartupStep('payload-build', 'error', {
          reason: 'missing-data-source',
          mode: 'worker-side',
        });
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        finishBuildSessionTransition({
          level: 'error',
          message: 'Failed to start build because data source is missing.',
        });
        return false;
      }
      if (selectionSummary.selectedAdminPairCount === 0) {
        finishBuildStartupStep('payload-build', 'error', {
          reason: 'selection-empty',
          mode: 'worker-side',
        });
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        finishBuildSessionTransition({
          level: 'error',
          message: 'Failed to start build because selection is empty.',
        });
        return false;
      }
      finishBuildStartupStep('payload-build', 'success', {
        mode: 'worker-side',
        dataSource: resolvedDataSource,
        selectedCountryCount: selectionSummary.selectedCountryCount,
        selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      });
      advanceBuildSessionTransitionPhase('starting-session');
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      beginBuildStartupStep('session-start-request', {
        source: startupSource,
        policy,
        payloadMode: 'worker-side',
        selectedCountryCount: selectionSummary.selectedCountryCount,
        selectedAdminPairCount: selectionSummary.selectedAdminPairCount,
      });
      let statusResult: Awaited<ReturnType<typeof bridgeRef.current.startBuildSession>>;
      try {
        statusResult = await runTimedStep('session-start-request', () => bridgeRef.current.startBuildSession(
          SHAPE_NODE_TYPE,
          activeNodeId,
          undefined,
          policy,
        ));
        finishBuildStartupStep('session-start-request', 'success', {
          status: statusResult.status,
          hasError: Boolean(statusResult.error),
          payloadMode: 'worker-side',
        });
      } catch (error) {
        finishBuildStartupStep('session-start-request', 'error', {
          errorMessage: getErrorMessage(error),
          payloadMode: 'worker-side',
        });
        throw error;
      }
      emitBuildSessionTransitionLog('info', 'start session response', {
        status: statusResult.status,
        hasError: Boolean(statusResult.error),
      });
      const nextStatus = statusResult.status === 'completed'
        ? 'completed'
        : statusResult.status === 'failed'
          ? 'failed'
          : 'processing';
      void updateSessionRecord({
        status: nextStatus === 'processing' ? 'running' : nextStatus,
        stopReason: nextStatus === 'processing' ? undefined : nextStatus,
        canResume: nextStatus === 'processing',
      });
      if (nextStatus === 'failed') {
        finishBuildSessionTransition({
          level: 'error',
          message: statusResult.error ?? 'Build failed before task execution started.',
        });
      } else if (nextStatus === 'completed') {
        finishBuildSessionTransition({
          level: 'info',
          message: 'Build completed immediately after start.',
        });
      } else {
        advanceBuildSessionTransitionPhase('awaiting-first-task', {
          level: 'info',
          message: 'Build requested. Waiting for worker task updates...',
        });
        beginBuildStartupStep('awaiting-first-task', {
          source: startupSource,
          mode: 'start',
        });
      }
      logStartResumeTrace('request-finished:success', {
        nextStatus,
      });
      return true;
    } catch (error) {
      logStartResumeTrace('request-finished:error', {
        errorMessage: getErrorMessage(error),
      });
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      finishBuildSessionTransition({
        level: 'error',
        message: 'Failed to start or resume build.',
      });
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [
    activeNodeId,
    advanceBuildSessionTransitionPhase,
    beginBuildSessionTransition,
    buildStatus,
    coordinator,
    data?.buildConfig?.dataSourceName,
    data?.selectedArrayByCountries,
    emitBuildSessionTransitionLog,
    beginBuildStartupStep,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    releaseBuildLock,
    runtimeStatus,
    saveDraftBeforeBuild,
    tryAcquireBuildLock,
    updateSessionRecord,
    waitForBuildLock,
  ]);

  const handlePause = useCallback(async (reason: 'route-leave' | 'user-pause' = 'user-pause'): Promise<void> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    if (isPausePending) return;
    await executePauseBuildFlow({
      reason,
      onPendingChange: setIsPausePending,
      pauseSession: async (pauseReason) => {
        await bridgeRef.current.initialize();
        await bridgeRef.current.pauseBuildSession(SHAPE_NODE_TYPE, activeNodeId, pauseReason);
      },
      persistPausedStatus: async (pauseReason) => {
        const persisted = await updateSessionRecord({
          status: 'paused',
          stopReason: pauseReason,
          canResume: true,
        });
        if (!persisted) {
          throw new Error('Failed to persist paused status.');
        }
      },
      onError: (error) => {
        notify.error('Failed to pause build.');
        console.error('[ShapeBuildProgressStep] pause failed', error);
      },
    });
  }, [activeNodeId, isPausePending, updateSessionRecord]);
  const { canStartOrResume, isStartPending, startOrResume, clearStartPending } = useShapeBuildAutoResume({
    activeNodeId,
    buildStatus,
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

  useEffect(() => {
    if (!lockRef.current) return;
    if (buildStatus === 'running' || runtimeStatus === 'processing' || isStartPending || buildSessionTransition.active) return;
    releaseBuildLock();
  }, [buildStatus, isStartPending, releaseBuildLock, runtimeStatus, buildSessionTransition.active]);
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
    isPausePending,
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
