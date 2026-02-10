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
import type { BuildStatus } from '@hierarchidb/components';
import { isSkippedMessage } from '../../../common/utils/taskMessages.ts';
import { getBuildMonitorKey } from '@hierarchidb/ui-monitoring';
import { useShapeBuildTiming } from './useShapeBuildTiming.ts';
import { useShapeBuildAutoResume } from './useShapeBuildAutoResume.ts';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { FetchTaskPayload } from '../../../common/types/index.js';
import { loadTreeConsoleSettings } from '@hierarchidb/util';
import type { AuthProviderType } from '@hierarchidb/ui-auth';
import { useShapeBuildStages } from './useShapeBuildStages.ts';
import { useShapeBuildProgressSummary } from './useShapeBuildProgressSummary.ts';
import { useShapeBuildLabels } from './useShapeBuildLabels.ts';
import type { BuildProgress, BuildProgressStatus } from './shapeBuildProgressMapping.ts';
import { resolveBuildStatusSource } from './resolveBuildStatusSource.ts';
import { executePauseBuildFlow } from './executePauseBuildFlow.ts';
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';

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

type StartLifecyclePhase =
  | 'idle'
  | 'acquiring-lock'
  | 'waiting-lock'
  | 'saving-draft'
  | 'initializing-worker'
  | 'building-payloads'
  | 'starting-session'
  | 'awaiting-first-task';

type StartLifecycleState = {
  active: boolean;
  phase: StartLifecyclePhase;
  startedAt: number;
};

type NotificationLevel = 'info' | 'warning' | 'error' | 'success';

const START_DIAGNOSTIC_WARN_MS = 10_000;
const START_DIAGNOSTIC_LONG_WAIT_MS = 20_000;
const START_DIAGNOSTIC_TIMEOUT_MS = 45_000;

const getStartLifecycleStatusLabel = (
  t: (key: string, fallback?: string) => string,
  phase: StartLifecyclePhase,
): string => {
  switch (phase) {
    case 'acquiring-lock':
      return t('stage.status.startingLock', 'Starting build (acquiring lock)...');
    case 'waiting-lock':
      return t('stage.status.startingQueue', 'Starting build (waiting for lock)...');
    case 'saving-draft':
      return t('stage.status.startingSave', 'Starting build (saving draft)...');
    case 'initializing-worker':
      return t('stage.status.startingWorker', 'Starting build (initializing worker)...');
    case 'building-payloads':
      return t('stage.status.startingPayload', 'Starting build (preparing tasks)...');
    case 'starting-session':
      return t('stage.status.startingSession', 'Starting build (launching session)...');
    case 'awaiting-first-task':
      return t('stage.status.startingAwait', 'Build requested; waiting for first task...');
    default:
      return t('stage.status.starting', 'Starting stage...');
  }
};


type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: NodeId;
};

export const useShapeBuildStep = ({ data, onChange, nodeId }: Args) => {
  const { t } = useTranslation();
  const coordinator = useMemo(() => (
    createSessionCoordinator({
      channelName: 'sessions',
      pollIntervalTimeout: 3000,
      quietThresholdTimeout: 5000,
      semaphoreTtlTimeout: 10000,
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
  const queueRequestedAtRef = useRef<number | null>(null);

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

  const writeWaitingHeartbeat = useCallback(async (requestedAt: number, now?: number) => {
    if (!activeNodeId) return;
    await coordinator.writeHeartbeat({
      sessionId: String(activeNodeId),
      status: 'waiting',
      progress: { requestedAt },
      timestamp: now ?? Date.now(),
      lockOwner: false,
    });
  }, [activeNodeId, coordinator]);

  const clearWaitingHeartbeat = useCallback(async () => {
    if (!activeNodeId) return;
    await coordinator.writeHeartbeat({
      sessionId: String(activeNodeId),
      status: null,
      progress: null,
      timestamp: Date.now(),
      lockOwner: false,
    });
  }, [activeNodeId, coordinator]);

  const waitForBuildLock = useCallback(async (requestedAt: number): Promise<boolean> => {
    if (!lockKey || !activeNodeId) return false;
    const sessionId = String(activeNodeId);
    const tabId = tabIdRef.current;
    const pollInterval = coordinator.pollIntervalTimeout;
    queueRequestedAtRef.current = requestedAt;

    const claimQueueIfAvailable = async (now: number) => {
      const heartbeat = await coordinator.readHeartbeat(sessionId);
      if (!heartbeat || heartbeat.expiresAt <= now || heartbeat.status !== 'waiting') {
        await writeWaitingHeartbeat(requestedAt, now);
        return { owner: true, requestedAt };
      }
      const heartbeatRequestedAt = (() => {
        const progress = heartbeat.progress as { requestedAt?: number } | null | undefined;
        return typeof progress?.requestedAt === 'number' ? progress.requestedAt : heartbeat.updatedAt;
      })();
      if (heartbeat.tabId === tabId) {
        return { owner: true, requestedAt: heartbeatRequestedAt ?? requestedAt };
      }
      if (heartbeatRequestedAt !== undefined && heartbeatRequestedAt <= requestedAt) {
        return { owner: false, requestedAt: heartbeatRequestedAt };
      }
      await writeWaitingHeartbeat(requestedAt, now);
      return { owner: true, requestedAt };
    };

    let queueState = await claimQueueIfAvailable(Date.now());
    while (true) {
      if (!queueState.owner) {
        await sleep(pollInterval);
        queueState = await claimQueueIfAvailable(Date.now());
        continue;
      }
      const lock = await coordinator.tryAcquireSessionLock(lockKey);
      if (lock) {
        lockRef.current = lock;
        lockKeyRef.current = lockKey;
        setIsLockOwner(true);
        await clearWaitingHeartbeat();
        return true;
      }
      await writeWaitingHeartbeat(queueState.requestedAt ?? requestedAt, Date.now());
      await sleep(pollInterval);
      queueState = await claimQueueIfAvailable(Date.now());
    }
  }, [activeNodeId, clearWaitingHeartbeat, coordinator, lockKey, writeWaitingHeartbeat]);
  const tabStateRef = useRef<Map<string, { state: 'active' | 'hidden' | 'frozen'; at: number }>>(new Map());
  const pollingTrackerRef = useRef(createPollingTracker({ quietThresholdTimeout: coordinator.quietThresholdTimeout }));
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;

  const [isPausePending, setIsPausePending] = useState(false);
  const [startLifecycle, setStartLifecycle] = useState<StartLifecycleState>({
    active: false,
    phase: 'idle',
    startedAt: 0,
  });
  const startLifecycleWarnStepRef = useRef<0 | 1 | 2 | 3>(0);
  const startLifecycleTaskStartNotifiedRef = useRef(false);
  const progressSnackbarKeyRef = useRef<string | null>(null);
  const [remoteProgress, setRemoteProgress] = useState<BuildProgress | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<BuildProgressStatus | null>(null);
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<number | null>(null);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
  const persistDraftPatchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistedStageElapsedByStage = useMemo<Record<string, number>>(
    () => (data?.stageElapsedByStage ?? {}),
    [data?.stageElapsedByStage]
  );
  const [completedStageElapsedMs, setCompletedStageElapsedMs] = useState<Record<string, number>>(
    () => persistedStageElapsedByStage
  );
  const completedStageElapsedRef = useRef<Record<string, number>>(persistedStageElapsedByStage);
  const lastTimingSnapshotRef = useRef<{ stageId: string | null; stageMs: number }>({
    stageId: null,
    stageMs: 0,
  });
  const lastBuildStatusRef = useRef<BuildStatus | null>(null);
  const lastElapsedStatusRef = useRef<BuildStatus | null>(null);
  const lastPersistedStageMapRef = useRef<Record<string, number> | null>(null);
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
  const emitStartLifecycleLog = useCallback((level: 'info' | 'warn' | 'error', event: string, extra?: Record<string, unknown>) => {
    const payload = {
      nodeId: activeNodeId ? String(activeNodeId) : null,
      ...extra,
    };
    if (level === 'error') {
      console.error(`[ShapeBuildProgressStep] ${event}`, payload);
      return;
    }
    if (level === 'warn') {
      console.warn(`[ShapeBuildProgressStep] ${event}`, payload);
      return;
    }
    console.info(`[ShapeBuildProgressStep] ${event}`, payload);
  }, [activeNodeId]);
  const pushStartLifecycleNotification = useCallback((level: NotificationLevel, message: string) => {
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
  const beginStartLifecycle = useCallback((phase: StartLifecyclePhase, message?: string) => {
    const now = Date.now();
    startLifecycleWarnStepRef.current = 0;
    startLifecycleTaskStartNotifiedRef.current = false;
    progressSnackbarKeyRef.current = null;
    setStartLifecycle({ active: true, phase, startedAt: now });
    emitStartLifecycleLog('info', 'start lifecycle begin', { phase });
    if (message) {
      pushStartLifecycleNotification('info', message);
    }
  }, [emitStartLifecycleLog, pushStartLifecycleNotification]);
  const advanceStartLifecycle = useCallback((phase: StartLifecyclePhase, options?: { message?: string; level?: NotificationLevel }) => {
    setStartLifecycle((current) => ({
      active: true,
      phase,
      startedAt: current.active ? current.startedAt : Date.now(),
    }));
    emitStartLifecycleLog('info', 'start lifecycle phase', { phase });
    if (options?.message) {
      pushStartLifecycleNotification(options.level ?? 'info', options.message);
    }
  }, [emitStartLifecycleLog, pushStartLifecycleNotification]);
  const finishStartLifecycle = useCallback((options?: { message?: string; level?: NotificationLevel }) => {
    setStartLifecycle({ active: false, phase: 'idle', startedAt: 0 });
    startLifecycleWarnStepRef.current = 0;
    startLifecycleTaskStartNotifiedRef.current = false;
    progressSnackbarKeyRef.current = null;
    if (options?.message) {
      emitStartLifecycleLog(
        options.level === 'error' ? 'error' : options.level === 'warning' ? 'warn' : 'info',
        'start lifecycle finish',
        { message: options.message },
      );
      pushStartLifecycleNotification(options.level ?? 'info', options.message);
      return;
    }
    emitStartLifecycleLog('info', 'start lifecycle finish');
  }, [emitStartLifecycleLog, pushStartLifecycleNotification]);
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

  const { progress, status, error } = useBuildProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const hasNodeId = Boolean(activeNodeId && !error);
  const remoteFresh = Boolean(remoteUpdatedAt && Date.now() - remoteUpdatedAt <= coordinator.quietThresholdTimeout);
  const effectiveProgress = hasNodeId ? (progress ?? (remoteFresh ? remoteProgress : null)) : null;
  const effectiveStatus = hasNodeId ? (status ?? (remoteFresh ? remoteStatus : null)) : null;
  const stages = useShapeBuildStages(t);
  const processingStatus = data?.processingStatus ?? 'idle';
  const persistedBuildElapsedMs = typeof data?.buildElapsedMs === 'number' ? data.buildElapsedMs : 0;
  const persistedBuildResumedAt = typeof data?.buildResumedAt === 'number' ? data.buildResumedAt : null;
  const persistedStageElapsedMs = typeof data?.stageElapsedMs === 'number' ? data.stageElapsedMs : 0;
  const persistedStageResumedAt = typeof data?.stageResumedAt === 'number' ? data.stageResumedAt : null;
  const persistedStageElapsedStageId = typeof data?.stageElapsedStageId === 'string'
    ? data.stageElapsedStageId
    : null;
  const [displayStageElapsedMs, setDisplayStageElapsedMs] = useState(0);
  const [displayStageRemainingMs, setDisplayStageRemainingMs] = useState<number | null>(null);
  const stageTickRef = useRef<number | null>(null);
  const stageRemainingTickRef = useRef<number | null>(null);
  const latestStageRemainingMsRef = useRef<number | null>(null);
  const lastDisplayStageIdRef = useRef<string | null>(null);
  const runtimeStatus = status?.status ?? null;
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
  const resolvedTaskType = taskType ?? effectiveStatus?.stage ?? stages[0]?.id;
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const monitorKey = useMemo(() => (
    getBuildMonitorKey(
      {
        storagePrefix: 'hdb:shape:stage-monitor',
        maxSamples: 3,
        memoryPressureRatio: 0.85,
        heapWarningRatio: 0.85,
        heapCriticalRatio: 0.9,
      },
      nodeId ? String(nodeId) : null
    )
  ), [nodeId]);
  const { timingSnapshot, session: timingSession } = useShapeBuildTiming({
    buildStatus,
    taskType,
    resolvedTaskType,
    nodeId,
    monitorKey,
    canWrite: isLockOwner,
  });
  const timingStageId = buildStatus === 'idle' ? null : (resolvedTaskType ?? null);
  const hasTimingSession = Boolean(timingSession?.startedAt) && processingStatus !== 'idle';
  const fallbackStageElapsedMs = (() => {
    if (!timingStageId || persistedStageElapsedStageId !== timingStageId) {
      return 0;
    }
    if (buildStatus !== 'running' || !persistedStageResumedAt) {
      return persistedStageElapsedMs;
    }
    const delta = Math.max(0, Date.now() - persistedStageResumedAt);
    return persistedStageElapsedMs + delta;
  })();
  const stageElapsedMs = hasTimingSession ? timingSnapshot.stageMs : fallbackStageElapsedMs;
  useEffect(() => {
    if (buildStatus !== 'idle') return;
    if (shallowEqualNumberRecord(completedStageElapsedMs, persistedStageElapsedByStage)) return;
    setCompletedStageElapsedMs(persistedStageElapsedByStage);
  }, [buildStatus, completedStageElapsedMs, persistedStageElapsedByStage]);
  useEffect(() => {
    completedStageElapsedRef.current = completedStageElapsedMs;
  }, [completedStageElapsedMs]);
  useEffect(() => {
    if (processingStatus !== 'idle') return;
    if (persistedBuildElapsedMs !== 0) return;
    if (persistedStageElapsedMs !== 0) return;
    if (persistedBuildResumedAt !== null) return;
    if (persistedStageResumedAt !== null) return;
    if (persistedStageElapsedStageId !== null) return;
    if (!shallowEqualNumberRecord(persistedStageElapsedByStage, {})) return;
    setDisplayStageElapsedMs(0);
    setDisplayStageRemainingMs(null);
    stageTickRef.current = null;
    stageRemainingTickRef.current = null;
    lastTimingSnapshotRef.current = { stageId: null, stageMs: 0 };
    lastDisplayStageIdRef.current = null;
    latestStageRemainingMsRef.current = null;
    setCompletedStageElapsedMs({});
  }, [
    persistedBuildElapsedMs,
    persistedBuildResumedAt,
    persistedStageElapsedByStage,
    persistedStageElapsedMs,
    persistedStageElapsedStageId,
    persistedStageResumedAt,
    processingStatus,
  ]);
  useEffect(() => {
    if (!timingStageId) {
      setDisplayStageElapsedMs(0);
      stageTickRef.current = null;
      lastDisplayStageIdRef.current = null;
      return;
    }
    if (lastDisplayStageIdRef.current !== timingStageId) {
      lastDisplayStageIdRef.current = timingStageId;
      setDisplayStageElapsedMs(stageElapsedMs);
      stageTickRef.current = null;
      return;
    }
    if (buildStatus !== 'running') {
      setDisplayStageElapsedMs((prev) => Math.max(prev, stageElapsedMs));
      stageTickRef.current = null;
      return;
    }
    if (displayStageElapsedMs === 0 && stageElapsedMs > 0) {
      setDisplayStageElapsedMs(stageElapsedMs);
    }
    if (stageTickRef.current === null) {
      stageTickRef.current = Date.now();
    }
  }, [buildStatus, displayStageElapsedMs, stageElapsedMs, timingStageId]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (!timingStageId) return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const last = stageTickRef.current ?? now;
      const step = Math.floor((now - last) / 1000) * 1000;
      if (step <= 0) return;
      stageTickRef.current = last + step;
      setDisplayStageElapsedMs((prev) => {
        const target = Math.max(prev, stageElapsedMs);
        const next = prev + step;
        return next > target ? target : next;
      });
    }, 300);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [buildStatus, stageElapsedMs, timingStageId]);

  const hasFailedFetchTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && normalizeStageKey(task) === 'fetch')
  ), [displayTasks]);

  const progressSummary = useShapeBuildProgressSummary({
    stages,
    resolvedTaskType,
    overallProgress,
    buildStatus,
    effectiveProgress: effectiveProgress ?? null,
    effectiveStatus: effectiveStatus ?? null,
    taskType,
    tasks: displayTasks,
    normalizeStageKey,
    isSkippedTask: (task) => isSkippedMessage(task.message),
    timingStageMs: displayStageElapsedMs,
  });
  const displayTotalElapsedMs = useMemo(() => {
    const completedTotalMs = sumNumberRecord(completedStageElapsedMs);
    if (!timingStageId) {
      return completedTotalMs;
    }
    const committedCurrentStageMs = completedStageElapsedMs[timingStageId] ?? 0;
    const activeStageContributionMs = Math.max(0, displayStageElapsedMs - committedCurrentStageMs);
    return completedTotalMs + activeStageContributionMs;
  }, [completedStageElapsedMs, displayStageElapsedMs, timingStageId]);
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
    setDisplayStageRemainingMs(latestStageRemainingMsRef.current);
    stageRemainingTickRef.current = window.setInterval(() => {
      setDisplayStageRemainingMs(latestStageRemainingMsRef.current);
    }, 1000);
    return () => {
      if (stageRemainingTickRef.current !== null) {
        window.clearInterval(stageRemainingTickRef.current);
        stageRemainingTickRef.current = null;
      }
    };
  }, [buildStatus]);

  useEffect(() => {
    lastBuildStatusRef.current = buildStatus;
    if (buildStatus === 'idle') {
      lastTimingSnapshotRef.current = { stageId: null, stageMs: 0 };
    }
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
    buildStatus === 'paused' || (!startLifecycle.active && displayTasks.length > 0)
  ), [buildStatus, displayTasks.length, startLifecycle.active]);
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
  }, [activeNodeId, buildStatus, data, workerClient]);

  const persistDraftPatch = useCallback(async (patch: Partial<ShapeEntity>): Promise<boolean> => {
    if (!activeNodeId || !workerClient) return false;
    const run = async (): Promise<boolean> => {
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
          draftData: {
            ...sanitizeShapeDraftData(currentDraftData),
            ...sanitizeShapeDraftData(patch),
          } as Record<string, unknown>,
        });
        onChange(patch);
        return true;
      } catch (error) {
        console.error('[ShapeBuildProgressStep] failed to persist build markers', error);
        return false;
      }
    };
    const queuedRun = persistDraftPatchQueueRef.current.then(run, run);
    persistDraftPatchQueueRef.current = queuedRun.then(() => undefined, () => undefined);
    return queuedRun;
  }, [activeNodeId, onChange, workerClient]);

  useEffect(() => {
    const previous = lastElapsedStatusRef.current;
    if (previous === buildStatus) return;
    lastElapsedStatusRef.current = buildStatus;
    if (!activeNodeId) return;
    const now = Date.now();
    if (previous === 'running' && buildStatus !== 'running') {
      if (!persistedBuildResumedAt) return;
      const delta = Math.max(0, now - persistedBuildResumedAt);
      const nextElapsedMs = persistedBuildElapsedMs + delta;
      const patch: Partial<ShapeEntity> = {
        buildElapsedMs: nextElapsedMs,
        buildResumedAt: undefined,
      };
      if (buildStatus === 'paused' || buildStatus === 'completed' || buildStatus === 'failed') {
        patch.processingStatus = buildStatus;
      }
      if (persistedStageResumedAt && timingStageId && persistedStageElapsedStageId === timingStageId) {
        const stageDelta = Math.max(0, now - persistedStageResumedAt);
        patch.stageElapsedMs = persistedStageElapsedMs + stageDelta;
        patch.stageResumedAt = undefined;
      }
      void persistDraftPatch(patch);
      return;
    }
    if (previous !== 'running' && buildStatus === 'running') {
      const patch: Partial<ShapeEntity> = {};
      if (data?.buildStartedAt === undefined) {
        patch.buildStartedAt = now;
      }
      if (data?.buildElapsedMs === undefined) {
        patch.buildElapsedMs = persistedBuildElapsedMs;
      }
      if (!persistedBuildResumedAt) {
        patch.buildResumedAt = now;
      }
      if (timingStageId) {
        if (persistedStageElapsedStageId !== timingStageId) {
          patch.stageElapsedStageId = timingStageId;
          patch.stageElapsedMs = 0;
        }
        if (!persistedStageResumedAt || persistedStageElapsedStageId !== timingStageId) {
          patch.stageResumedAt = now;
        }
      }
      if (Object.keys(patch).length > 0) {
        void persistDraftPatch(patch);
      }
    }
  }, [
    activeNodeId,
    buildStatus,
    data?.buildElapsedMs,
    data?.buildResumedAt,
    data?.buildStartedAt,
    persistDraftPatch,
    persistedBuildElapsedMs,
    persistedBuildResumedAt,
  ]);

  useEffect(() => {
    if (!timingStageId) return;
    const previous = lastTimingSnapshotRef.current;
    const previousStageId = previous.stageId;
    if (previousStageId && previousStageId !== timingStageId) {
      const previousElapsedMs = previous.stageMs;
      const currentCompleted = completedStageElapsedRef.current;
      const needsCommit = previousElapsedMs > 0 && currentCompleted[previousStageId] === undefined;
      const nextCompleted = needsCommit
        ? { ...currentCompleted, [previousStageId]: previousElapsedMs }
        : currentCompleted;
      if (needsCommit) {
        setCompletedStageElapsedMs(nextCompleted);
      }
      lastPersistedStageMapRef.current = nextCompleted;
      const now = Date.now();
      const patch: Partial<ShapeEntity> = {
        stageElapsedByStage: nextCompleted,
        stageElapsedStageId: timingStageId,
        stageElapsedMs: 0,
        stageResumedAt: buildStatus === 'running' ? now : undefined,
      };
      void persistDraftPatch(patch);
    }
    lastTimingSnapshotRef.current = { stageId: timingStageId, stageMs: stageElapsedMs };
  }, [
    buildStatus,
    persistDraftPatch,
    stageElapsedMs,
    timingStageId,
  ]);

  useEffect(() => {
    if (!timingStageId) return;
    if (!['completed', 'failed'].includes(buildStatus)) return;
    if (stageElapsedMs <= 0) return;
    setCompletedStageElapsedMs((current) => {
      if (current[timingStageId]) return current;
      return { ...current, [timingStageId]: stageElapsedMs };
    });
  }, [buildStatus, stageElapsedMs, timingStageId]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (shallowEqualNumberRecord(completedStageElapsedMs, persistedStageElapsedByStage)) return;
    if (lastPersistedStageMapRef.current
      && shallowEqualNumberRecord(lastPersistedStageMapRef.current, completedStageElapsedMs)) {
      return;
    }
    lastPersistedStageMapRef.current = completedStageElapsedMs;
    void persistDraftPatch({ stageElapsedByStage: completedStageElapsedMs });
  }, [activeNodeId, completedStageElapsedMs, persistDraftPatch, persistedStageElapsedByStage]);

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
      await persistDraftPatch({ processingStatus: 'processing' });
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
    persistDraftPatch,
    releaseBuildLock,
    runtimeStatus,
    tryAcquireBuildLock,
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
    const message = typeof effectiveProgress?.message === 'string'
      ? effectiveProgress.message.trim()
      : '';
    if (!message) return;
    if (!startLifecycle.active && buildStatus !== 'running' && runtimeStatus !== 'processing') return;
    const key = `${resolvedTaskType ?? ''}:${message}`;
    if (progressSnackbarKeyRef.current === key) return;
    progressSnackbarKeyRef.current = key;
    emitStartLifecycleLog('info', 'worker progress update', {
      stage: resolvedTaskType ?? null,
      message,
      percentage: effectiveProgress?.percentage ?? null,
    });
    pushStartLifecycleNotification('info', `Build progress: ${message}`);
  }, [
    buildStatus,
    effectiveProgress?.message,
    effectiveProgress?.percentage,
    emitStartLifecycleLog,
    pushStartLifecycleNotification,
    resolvedTaskType,
    runtimeStatus,
    startLifecycle.active,
  ]);

  useEffect(() => {
    if (!startLifecycle.active) return;
    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - startLifecycle.startedAt;
      if (elapsedMs >= START_DIAGNOSTIC_TIMEOUT_MS && startLifecycleWarnStepRef.current < 3) {
        startLifecycleWarnStepRef.current = 3;
        emitStartLifecycleLog('error', 'start lifecycle timeout', {
          phase: startLifecycle.phase,
          elapsedMs,
        });
        pushStartLifecycleNotification(
          'error',
          'Build did not start task processing. Please check worker status or restart the session.',
        );
        return;
      }
      if (elapsedMs >= START_DIAGNOSTIC_LONG_WAIT_MS && startLifecycleWarnStepRef.current < 2) {
        startLifecycleWarnStepRef.current = 2;
        emitStartLifecycleLog('warn', 'start lifecycle long wait', {
          phase: startLifecycle.phase,
          elapsedMs,
        });
        pushStartLifecycleNotification(
          'warning',
          `Build start is still waiting at "${startLifecycle.phase}".`,
        );
        return;
      }
      if (elapsedMs >= START_DIAGNOSTIC_WARN_MS && startLifecycleWarnStepRef.current < 1) {
        startLifecycleWarnStepRef.current = 1;
        emitStartLifecycleLog('info', 'start lifecycle wait', {
          phase: startLifecycle.phase,
          elapsedMs,
        });
        pushStartLifecycleNotification(
          'info',
          `Build start is taking longer than expected (${startLifecycle.phase}).`,
        );
      }
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    emitStartLifecycleLog,
    pushStartLifecycleNotification,
    startLifecycle.active,
    startLifecycle.phase,
    startLifecycle.startedAt,
  ]);

  useEffect(() => {
    if (!startLifecycle.active) return;
    if (hasStartedTasks) {
      if (!startLifecycleTaskStartNotifiedRef.current) {
        startLifecycleTaskStartNotifiedRef.current = true;
        emitStartLifecycleLog('info', 'task execution started', {
          tasks: displayTasks.length,
        });
        pushStartLifecycleNotification('success', 'Build task execution started.');
      }
      finishStartLifecycle();
      return;
    }
    if (buildStatus === 'completed') {
      if (displayTasks.length === 0) {
        finishStartLifecycle({
          level: 'info',
          message: 'Build completed without generating tasks.',
        });
        return;
      }
      finishStartLifecycle();
      return;
    }
    if (buildStatus === 'failed') {
      finishStartLifecycle({
        level: 'error',
        message: 'Build failed before task execution started.',
      });
      return;
    }
    if (buildStatus === 'paused' && !isPausePending) {
      finishStartLifecycle({
        level: 'warning',
        message: 'Build paused before task execution started.',
      });
    }
  }, [
    buildStatus,
    displayTasks.length,
    emitStartLifecycleLog,
    finishStartLifecycle,
    hasStartedTasks,
    isPausePending,
    pushStartLifecycleNotification,
    startLifecycle.active,
  ]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (startLifecycle.active) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const shouldMonitor = data?.processingStatus === 'processing' && !data?.buildFinishedAt;
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
    data?.buildFinishedAt,
    data?.processingStatus,
    getRecentNonActiveState,
    runtimeStatus,
    startLifecycle.active,
    suspendSuspectOpen,
    t,
  ]);

  const buildDownloadTaskPayloads = useCallback(async (): Promise<FetchTaskPayload[] | null> => {
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return null;
    }
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return null;
    }
    const resolvedDataSource = data?.buildConfig?.dataSourceName;
    if (!resolvedDataSource) {
      notify.warning('Data source is missing.');
      return null;
    }
    const selectionRecord = data?.selectedArrayByCountries;
    if (!selectionRecord || (typeof selectionRecord === 'object' && !Array.isArray(selectionRecord) && Object.keys(selectionRecord).length === 0)) {
      notify.warning('Selection is empty.');
      return null;
    }
    const api = workerClient.getAPI();
    return api.generateShapeDownloadTaskPayloadsFromSelection(
      activeNodeId,
      resolvedDataSource,
      selectionRecord,
    ) as Promise<FetchTaskPayload[]>;
  }, [activeNodeId, data?.buildConfig?.dataSourceName, data?.selectedArrayByCountries, workerClient]);

  const handleStartOrResume = useCallback(async (options?: { forceRestart?: boolean; autoResume?: boolean }): Promise<boolean> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    beginStartLifecycle(
      'acquiring-lock',
      options?.autoResume
        ? 'Resuming build session...'
        : 'Starting build session...',
    );
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) {
      finishStartLifecycle({
        level: 'warning',
        message: 'Another build session is already active in this tab.',
      });
      return false;
    }
    const acquired = await tryAcquireBuildLock({ notifyOnFailure: !options?.autoResume });
    if (!acquired) {
      advanceStartLifecycle('waiting-lock', {
        level: 'info',
        message: 'Waiting for build lock held by another tab...',
      });
      const queued = await waitForBuildLock(now);
      if (!queued) {
        finishStartLifecycle({
          level: 'warning',
          message: 'Build start was cancelled while waiting for lock.',
        });
        return false;
      }
    }
    coordinator.writeActiveSessionId(String(activeNodeId));
    advanceStartLifecycle('saving-draft');
    const saved = await saveDraftBeforeBuild();
    if (!saved) {
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      finishStartLifecycle({
        level: 'error',
        message: 'Failed to start build because draft save did not complete.',
      });
      return false;
    }
    try {
      advanceStartLifecycle('initializing-worker');
      await bridgeRef.current.initialize();
      advanceStartLifecycle('building-payloads');
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads) {
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        finishStartLifecycle({
          level: 'error',
          message: 'Failed to start build because task payloads could not be prepared.',
        });
        return false;
      }
      if (payloads.length === 0) {
        const finishedAt = Date.now();
        const persisted = await persistDraftPatch({
          processingStatus: 'completed',
          buildFinishedAt: finishedAt,
          stopReason: undefined,
        });
        if (!persisted) {
          emitStartLifecycleLog('warn', 'failed to persist empty-task completion marker');
        }
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        finishStartLifecycle({
          level: 'info',
          message: 'No tasks were generated. Build completed immediately.',
        });
        return true;
      }
      advanceStartLifecycle('starting-session');
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      const statusResult = await bridgeRef.current.startBuildSession(SHAPE_NODE_TYPE, activeNodeId, payloads, policy);
      emitStartLifecycleLog('info', 'start session response', {
        status: statusResult.status,
        hasError: Boolean(statusResult.error),
      });
      const nextStatus = statusResult.status === 'completed'
        ? 'completed'
        : statusResult.status === 'failed'
          ? 'failed'
          : 'processing';
      const persisted = await persistDraftPatch({ processingStatus: nextStatus });
      if (!persisted) {
        throw new Error('Failed to persist start status.');
      }
      if (nextStatus === 'failed') {
        finishStartLifecycle({
          level: 'error',
          message: statusResult.error ?? 'Build failed before task execution started.',
        });
      } else if (nextStatus === 'completed') {
        finishStartLifecycle({
          level: 'info',
          message: 'Build completed immediately after start.',
        });
      } else {
        advanceStartLifecycle('awaiting-first-task', {
          level: 'info',
          message: 'Build requested. Waiting for worker task updates...',
        });
      }
      return true;
    } catch (error) {
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      finishStartLifecycle({
        level: 'error',
        message: 'Failed to start or resume build.',
      });
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [
    activeNodeId,
    advanceStartLifecycle,
    beginStartLifecycle,
    buildDownloadTaskPayloads,
    coordinator,
    emitStartLifecycleLog,
    finishStartLifecycle,
    persistDraftPatch,
    releaseBuildLock,
    saveDraftBeforeBuild,
    tryAcquireBuildLock,
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
        const persisted = await persistDraftPatch({ processingStatus: 'paused', stopReason: pauseReason });
        if (!persisted) {
          throw new Error('Failed to persist paused status.');
        }
      },
      onError: (error) => {
        notify.error('Failed to pause build.');
        console.error('[ShapeBuildProgressStep] pause failed', error);
      },
    });
  }, [activeNodeId, isPausePending, persistDraftPatch]);
  const { canStartOrResume, isStartPending, startOrResume } = useShapeBuildAutoResume({
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
    if (!lockRef.current) return;
    if (buildStatus === 'running' || runtimeStatus === 'processing' || isStartPending || startLifecycle.active) return;
    releaseBuildLock();
  }, [buildStatus, isStartPending, releaseBuildLock, runtimeStatus, startLifecycle.active]);
  const effectiveBuildStatus: BuildStatus = buildStatus;
  const effectiveStatusLabel = startLifecycle.active
    ? getStartLifecycleStatusLabel(t, startLifecycle.phase)
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
    stageElapsedMs: displayStageElapsedMs,
    stageRemainingMs: displayStageRemainingMs,
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: closeCrashSuspect,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: closeSuspendSuspect,
  };
};
