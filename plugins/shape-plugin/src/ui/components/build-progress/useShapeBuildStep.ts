import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  createSessionCoordinator,
  type HeartbeatRecord,
  type SessionTabState,
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
import { sanitizeShapeDraftData } from '../../utils/sanitizeShapeDraftData.ts';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
type StageLikeTask = {
  taskType?: TaskStage;
  type?: TaskStage;
  stage: TaskStage;
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
  const isWebLockSupported = coordinator.isWebLockSupported();
  const lockRef = useRef<SessionLockHandle | null>(null);
  const lockKeyRef = useRef<string | null>(null);
  const [isLockOwner, setIsLockOwner] = useState(false);
  const [remoteHeartbeat, setRemoteHeartbeat] = useState<HeartbeatRecord<BuildProgressStatus, BuildProgress> | null>(null);
  const [lockState, setLockState] = useState<'held' | 'free' | 'unsupported' | null>(null);
  const lastHeartbeatPruneAtRef = useRef<number | null>(null);
  const localTabStateRef = useRef<SessionTabState>('active');
  // Allow the next stage to enqueue tasks before treating the pipeline as stalled.
  const stageTransitionGraceMs = 20000;
  const stageTransitionRef = useRef<{ startedAt: number | null; lastStageId: string | null; nextStageId: string | null }>({
    startedAt: null,
    lastStageId: null,
    nextStageId: null,
  });

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
    if (!isWebLockSupported) {
      if (options?.notifyOnFailure) {
        notify.error('Web Locks API is unavailable.');
      }
      return false;
    }
    const lock = await coordinator.tryAcquireSessionLock(lockKey);
    if (!lock) {
      if (options?.notifyOnFailure) {
        notify.info('Another tab is already running this build.');
      }
      return false;
    }
    lockRef.current = lock;
    lockKeyRef.current = lockKey;
    setIsLockOwner(true);
    return true;
  }, [coordinator, isWebLockSupported, lockKey]);
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const crashHandledRef = useRef(false);
  const crashDialogSuppressUntilRef = useRef<number | null>(null);
  void crashHandledRef.current;
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;

  const [isPausePending, setIsPausePending] = useState(false);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
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

  const { progress, status, error } = useBuildProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const hasNodeId = Boolean(activeNodeId && !error);
  const remoteUpdatedAt = remoteHeartbeat?.updatedAt ?? null;
  const remoteExpiresAt = remoteHeartbeat?.expiresAt ?? null;
  const remoteTabState = remoteHeartbeat?.tabState ?? null;
  const remoteTabId = remoteHeartbeat?.tabId ?? null;
  const heartbeatWindowMs = coordinator.quietThresholdTimeout + coordinator.pollIntervalTimeout * 2;
  const heartbeatFresh = useMemo(() => {
    if (!remoteUpdatedAt) return false;
    const now = Date.now();
    const transitionStartedAt = stageTransitionRef.current?.startedAt ?? null;
    const transitionGraceActive = transitionStartedAt !== null
      && now - transitionStartedAt < stageTransitionGraceMs;
    if (transitionGraceActive) {
      console.log('[ShapeBuildProgressStep] crash check suppressed by stage transition grace', {
        nodeId: activeNodeId ? String(activeNodeId) : null,
        elapsedMs: transitionStartedAt ? now - transitionStartedAt : null,
        lastStageId: stageTransitionRef.current?.lastStageId ?? null,
        nextStageId: stageTransitionRef.current?.nextStageId ?? null,
      });
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    if (typeof remoteExpiresAt === 'number' && remoteExpiresAt > now) return true;
    return now - remoteUpdatedAt <= heartbeatWindowMs;
  }, [heartbeatWindowMs, remoteExpiresAt, remoteUpdatedAt]);
  const remoteFresh = heartbeatFresh;
  const effectiveProgress = hasNodeId ? (progress ?? (remoteFresh ? remoteHeartbeat?.progress ?? null : null)) : null;
  const effectiveStatus = hasNodeId ? (status ?? (remoteFresh ? remoteHeartbeat?.status ?? null : null)) : null;
  const stages = useShapeBuildStages(t);
  const processingStatus = data?.processingStatus ?? 'idle';
  const runtimeStatus = status?.status ?? null;
  const statusSource = effectiveStatus?.status ?? processingStatus;
  const baseBuildStatus = useMemo<BuildStatus>(() => (
    toBuildStatus(statusSource)
  ), [statusSource]);
  const { tasks, isLoading: isTasksLoading } = useShapeBuildTasks(activeNodeId);
  const isTaskSummaryLoading = false;
  const displayTasks = tasks;
  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);
  const hasLiveRunner = useMemo(() => (
    isLockOwner || lockState === 'held' || heartbeatFresh
  ), [heartbeatFresh, isLockOwner, lockState]);
  const shouldMonitor = data?.processingStatus === 'processing' && !data?.buildFinishedAt;
  const tasksCompletionStatus = useMemo<BuildStatus | null>(() => {
    if (displayTasks.length === 0) return null;
    if (hasInFlightTasks) return null;
    const hasFailed = displayTasks.some((task) => task.status === 'failed');
    if (hasFailed) return 'failed';
    if (shouldMonitor) return null;
    return 'completed';
  }, [displayTasks, hasInFlightTasks, shouldMonitor]);
  const hasStalledInFlightTasks = hasInFlightTasks && shouldMonitor && !hasLiveRunner;
  const buildStatus = useMemo<BuildStatus>(() => {
    if (tasksCompletionStatus === 'failed') {
      return 'failed';
    }
    if (hasInFlightTasks && hasLiveRunner) {
      return 'running';
    }
    if (hasStalledInFlightTasks) {
      return 'paused';
    }
    if (shouldMonitor && !hasLiveRunner && baseBuildStatus === 'running') {
      return 'paused';
    }
    return baseBuildStatus;
  }, [
    baseBuildStatus,
    hasInFlightTasks,
    hasLiveRunner,
    hasStalledInFlightTasks,
    shouldMonitor,
    tasksCompletionStatus,
  ]);
  useEffect(() => {
    if (!isPausePending) return;
    if (buildStatus !== 'running') {
      setIsPausePending(false);
    }
  }, [buildStatus, isPausePending]);

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
  const { timingSnapshot } = useShapeBuildTiming({
    buildStatus,
    taskType,
    resolvedTaskType,
    nodeId,
    monitorKey,
    canWrite: isLockOwner,
  });

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
    timingStageMs: timingSnapshot.stageMs,
  });
  const stageTransition = useMemo(() => {
    if (!shouldMonitor) {
      return { isGap: false, lastStageId: null, nextStageId: null };
    }
    const tasksByStage = progressSummary.tasksByStage;
    let lastStageId: string | null = null;
    stages.forEach((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.length > 0) {
        lastStageId = stage.id;
      }
    });
    if (!lastStageId) {
      return { isGap: false, lastStageId: null, nextStageId: null };
    }
    const lastStageTasks = tasksByStage[lastStageId] ?? [];
    const lastStageHasInFlight = lastStageTasks.some(
      (task) => task.status === 'running' || task.status === 'queued',
    );
    if (lastStageHasInFlight) {
      return { isGap: false, lastStageId, nextStageId: null };
    }
    const lastStageIndex = stages.findIndex((stage) => stage.id === lastStageId);
    const nextStageId = lastStageIndex >= 0 ? (stages[lastStageIndex + 1]?.id ?? null) : null;
    if (!nextStageId) {
      return { isGap: false, lastStageId, nextStageId: null };
    }
    const nextStageTasks = tasksByStage[nextStageId] ?? [];
    const nextStageStarted = nextStageTasks.length > 0;
    return {
      isGap: !nextStageStarted,
      lastStageId,
      nextStageId,
    };
  }, [progressSummary.tasksByStage, shouldMonitor, stages]);
  useEffect(() => {
    if (!stageTransition.isGap) {
      const current = stageTransitionRef.current;
      if (current.startedAt && current.lastStageId && current.nextStageId) {
        console.log('[ShapeBuildProgressStep] stage transition resolved', {
          nodeId: nodeId ? String(nodeId) : null,
          lastStageId: current.lastStageId,
          nextStageId: current.nextStageId,
          elapsedMs: Date.now() - current.startedAt,
        });
      }
      stageTransitionRef.current = { startedAt: null, lastStageId: null, nextStageId: null };
      return;
    }
    const current = stageTransitionRef.current;
    if (
      current.startedAt
      && current.lastStageId === stageTransition.lastStageId
      && current.nextStageId === stageTransition.nextStageId
    ) {
      return;
    }
    const startedAt = Date.now();
    stageTransitionRef.current = {
      startedAt,
      lastStageId: stageTransition.lastStageId,
      nextStageId: stageTransition.nextStageId,
    };
    console.log('[ShapeBuildProgressStep] stage transition gap detected', {
      nodeId: nodeId ? String(nodeId) : null,
      lastStageId: stageTransition.lastStageId,
      nextStageId: stageTransition.nextStageId,
      startedAt,
    });
  }, [nodeId, stageTransition.isGap, stageTransition.lastStageId, stageTransition.nextStageId]);
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

  useEffect(() => {
    if (!activeNodeId) return;
    if (buildStatus !== 'running' && runtimeStatus !== 'processing') return;
    const activeSessionId = coordinator.readActiveSessionId();
    if (!activeSessionId) {
      coordinator.writeActiveSessionId(String(activeNodeId));
    }
  }, [activeNodeId, buildStatus, coordinator, runtimeStatus]);

  useEffect(() => {
    if (!activeNodeId) return;
    console.log('[ShapeBuildProgressStep] status snapshot', {
      nodeId: String(activeNodeId),
      buildStatus,
      runtimeStatus,
      processingStatus: data?.processingStatus,
      lockState,
      heartbeatFresh,
      hasLiveRunner,
      stageGap: stageTransitionRef.current?.startedAt ? {
        lastStageId: stageTransitionRef.current.lastStageId,
        nextStageId: stageTransitionRef.current.nextStageId,
        elapsedMs: Date.now() - stageTransitionRef.current.startedAt,
      } : null,
    });
  }, [
    activeNodeId,
    buildStatus,
    data?.processingStatus,
    hasLiveRunner,
    heartbeatFresh,
    lockState,
    runtimeStatus,
  ]);

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

  const saveDraftBeforeBatch = useCallback(async (patch?: Partial<ShapeEntity>) => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return false;
    }
    const baseBatchConfig = {
      ...(data?.buildConfig ?? {}),
      ...(patch?.buildConfig ?? {}),
    };
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(activeNodeId, {
        mode: 'save-draft',
        draftData: {
          ...sanitizeShapeDraftData(data ?? {}),
          ...sanitizeShapeDraftData(patch ?? {}),
          batchConfig: baseBatchConfig,
        } as Record<string, unknown>,
      });
      return true;
    } catch (error) {
      notify.error('Failed to save draft.');
      console.error('[ShapeBuildProgressStep] save draft failed', error);
      return false;
    }
  }, [activeNodeId, buildStatus, data, workerClient]);

  const persistDraftPatch = useCallback(async (patch: Partial<ShapeEntity>) => {
    if (!activeNodeId || !workerClient) return;
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(activeNodeId, {
        mode: 'save-draft',
        draftData: {
          ...sanitizeShapeDraftData(data ?? {}),
          ...sanitizeShapeDraftData(patch),
        } as Record<string, unknown>,
      });
      onChange(patch);
    } catch (error) {
      console.error('[ShapeBuildProgressStep] failed to persist build markers', error);
    }
  }, [activeNodeId, data, onChange, workerClient]);

  const maybeAutoResume = useCallback(async () => {
    if (!activeNodeId) return;
    if (buildStatus === 'running' || runtimeStatus === 'processing') return;
    if (data?.processingStatus !== 'processing') return;
    if (!isWebLockSupported) return;
    if (!heartbeatFresh && lockState !== 'held') return;
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) return;
    if (remoteUpdatedAt && remoteTabId && remoteTabId !== tabIdRef.current) {
      if (now - remoteUpdatedAt < coordinator.quietThresholdTimeout) return;
    }
    if (remoteTabState && remoteTabState !== 'active' && remoteUpdatedAt && now - remoteUpdatedAt <= suspendTimeout) return;
    const lastAutoResumeAt = lastAutoResumeAtRef.current;
    if (lastAutoResumeAt && now - lastAutoResumeAt < coordinator.quietThresholdTimeout) return;
    const acquired = await tryAcquireBuildLock();
    if (!acquired) return;
    lastAutoResumeAtRef.current = now;
    coordinator.writeActiveSessionId(String(activeNodeId));
    try {
      await bridgeRef.current.initialize();
      const status = await bridgeRef.current.getBatchSessionStatus(SHAPE_NODE_TYPE, activeNodeId);
      if (status.status !== 'running') {
        releaseBuildLock();
        return;
      }
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, activeNodeId, policy);
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
    data?.processingStatus,
    heartbeatFresh,
    isWebLockSupported,
    lockState,
    persistDraftPatch,
    releaseBuildLock,
    remoteTabId,
    remoteTabState,
    remoteUpdatedAt,
    runtimeStatus,
    suspendTimeout,
    tryAcquireBuildLock,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      localTabStateRef.current = isHidden ? 'hidden' : 'active';
    };
    const handlePageHide = () => {
      localTabStateRef.current = 'frozen';
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!activeNodeId) {
      setRemoteHeartbeat(null);
      setLockState(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const now = Date.now();
      const record = await coordinator.readHeartbeat<BuildProgressStatus, BuildProgress>(String(activeNodeId));
      if (cancelled) return;
      setRemoteHeartbeat(record);
      if (!lastHeartbeatPruneAtRef.current || now - lastHeartbeatPruneAtRef.current > coordinator.quietThresholdTimeout) {
        lastHeartbeatPruneAtRef.current = now;
        void coordinator.pruneHeartbeats(now);
      }
      void maybeAutoResume();
    };
    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, coordinator.pollIntervalTimeout);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeNodeId, coordinator, maybeAutoResume]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!isLockOwner) return;
    if (!shouldMonitor) return;
    const tick = () => {
      const now = Date.now();
      const activeSessionId = coordinator.readActiveSessionId();
      if (activeSessionId !== String(activeNodeId)) return;
      void coordinator.writeHeartbeat({
        sessionId: String(activeNodeId),
        status: status ?? null,
        progress: progress ?? null,
        tabState: localTabStateRef.current,
        lockOwner: true,
        timestamp: now,
      });
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [activeNodeId, coordinator, isLockOwner, progress, shouldMonitor, status]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!shouldMonitor) {
      crashHandledRef.current = false;
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const transitionStartedAt = stageTransitionRef.current?.startedAt ?? null;
    if (hasLiveRunner && !transitionStartedAt) {
      crashHandledRef.current = false;
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    if (crashHandledRef.current) {
      return;
    }
    const now = Date.now();
    const transitionGraceActive = transitionStartedAt !== null
      && now - transitionStartedAt < stageTransitionGraceMs;
    if (transitionGraceActive) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const suppressUntil = crashDialogSuppressUntilRef.current;
    if (suppressUntil && now < suppressUntil) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const elapsedSinceStart = now - crashCheckStartedAtRef.current;
    if (elapsedSinceStart < coordinator.quietThresholdTimeout) return;
    let cancelled = false;
    const check = async () => {
      if (!lockKey) return;
      const lockState = await coordinator.probeSessionLock(lockKey);
      if (cancelled) return;
      setLockState(lockState);
      const heartbeatIsFresh = heartbeatFresh;
      const transitionStalled = transitionStartedAt !== null
        && now - transitionStartedAt >= stageTransitionGraceMs;
      if (transitionStalled && lockState !== 'held' && !heartbeatIsFresh) {
        console.log('[ShapeBuildProgressStep] transition stalled -> pause', {
          nodeId: activeNodeId ? String(activeNodeId) : null,
          lockState,
          heartbeatFresh: heartbeatIsFresh,
          transitionElapsedMs: transitionStartedAt ? now - transitionStartedAt : null,
        });
        if (crashSuspectOpen) {
          closeCrashSuspect();
        }
        if (suspendSuspectOpen) {
          closeSuspendSuspect();
        }
        try {
          await persistDraftPatch({ processingStatus: 'paused', stopReason: 'unknown' });
          releaseBuildLock();
          coordinator.clearActiveSessionId(String(activeNodeId));
          crashHandledRef.current = true;
        } catch (error) {
          console.error('[ShapeBuildProgressStep] transition pause failed', error);
        }
        return;
      }
      const recentNonActive = Boolean(
        remoteTabState
        && remoteTabState !== 'active'
        && remoteUpdatedAt
        && now - remoteUpdatedAt <= suspendTimeout
      );
      if (lockState === 'held') {
        if (recentNonActive || !heartbeatIsFresh) {
          console.log('[ShapeBuildProgressStep] suspend suspect (lock held)', {
            nodeId: activeNodeId ? String(activeNodeId) : null,
            heartbeatFresh: heartbeatIsFresh,
            recentNonActive,
          });
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
        if (crashSuspectOpen) {
          closeCrashSuspect();
        }
        if (suspendSuspectOpen) {
          closeSuspendSuspect();
        }
        return;
      }
      if (lockState === 'unsupported') {
        console.log('[ShapeBuildProgressStep] crash suspect (lock unsupported)', {
          nodeId: activeNodeId ? String(activeNodeId) : null,
        });
        if (!crashSuspectOpen) {
          setCrashSuspectMessage(
            t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
          );
          setCrashSuspectOpen(true);
        }
        return;
      }
      if (heartbeatIsFresh) {
        console.log('[ShapeBuildProgressStep] crash check skipped (heartbeat fresh)', {
          nodeId: activeNodeId ? String(activeNodeId) : null,
          lockState,
        });
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
      try {
        console.log('[ShapeBuildProgressStep] crash suspend -> pause', {
          nodeId: activeNodeId ? String(activeNodeId) : null,
          lockState,
          heartbeatFresh: heartbeatIsFresh,
        });
        await persistDraftPatch({ processingStatus: 'paused', stopReason: 'unknown' });
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        crashHandledRef.current = true;
      } catch (error) {
        console.error('[ShapeBuildProgressStep] crash suspend failed', error);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [
    activeNodeId,
    buildStatus,
    closeCrashSuspect,
    closeSuspendSuspect,
    coordinator,
    crashSuspectOpen,
    heartbeatFresh,
    lockKey,
    persistDraftPatch,
    releaseBuildLock,
    remoteTabState,
    remoteUpdatedAt,
    hasLiveRunner,
    shouldMonitor,
    stageTransitionGraceMs,
    suspendSuspectOpen,
    suspendTimeout,
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

  const canResume = buildStatus === 'paused';
  const canStartOrResumeNow = !isPausePending;
  const handleStartOrResume = useCallback(async (options?: { forceRestart?: boolean; autoResume?: boolean }): Promise<boolean> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!canStartOrResumeNow) {
      return false;
    }
    const startAt = Date.now();
    crashDialogSuppressUntilRef.current = startAt + 10000;
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    console.log('[ShapeBuildProgressStep] start/resume requested', {
      nodeId: String(activeNodeId),
      autoResume: options?.autoResume ?? false,
      forceRestart: options?.forceRestart ?? false,
      canResume,
      buildStatus,
      runtimeStatus,
      processingStatus: data?.processingStatus,
      lockState,
      heartbeatFresh,
      activeSessionId,
      hasRunner,
      now,
    });
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) {
      notify.info('Another build session is active in this tab.');
      return false;
    }
    const acquired = await tryAcquireBuildLock({ notifyOnFailure: !options?.autoResume });
    if (!acquired) {
      console.log('[ShapeBuildProgressStep] start/resume lock acquire failed', {
        nodeId: String(activeNodeId),
        lockState,
        heartbeatFresh,
      });
      return false;
    }
    console.log('[ShapeBuildProgressStep] start/resume lock acquired', {
      nodeId: String(activeNodeId),
      lockState: 'held',
      at: Date.now(),
    });
    coordinator.writeActiveSessionId(String(activeNodeId));
    // autoResumeBuild is only set by route transitions (build=1). Avoid writing on manual clicks.
    if (canResume && !options?.forceRestart) {
      try {
        await bridgeRef.current.initialize();
        const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
        await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, activeNodeId, policy);
        await persistDraftPatch({ processingStatus: 'processing' });
        console.log('[ShapeBuildProgressStep] resume requested', {
          nodeId: String(activeNodeId),
          policy,
          elapsedMs: Date.now() - startAt,
        });
        return true;
      } catch (error) {
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        notify.error('Failed to resume build.');
        console.error('[ShapeBuildProgressStep] resume failed', error);
        return false;
      }
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      console.log('[ShapeBuildProgressStep] start blocked: save draft failed', {
        nodeId: String(activeNodeId),
        elapsedMs: Date.now() - startAt,
      });
      return false;
    }
    try {
      await bridgeRef.current.initialize();
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads || payloads.length === 0) {
        releaseBuildLock();
        coordinator.clearActiveSessionId(String(activeNodeId));
        console.log('[ShapeBuildProgressStep] start blocked: payloads empty', {
          nodeId: String(activeNodeId),
          elapsedMs: Date.now() - startAt,
        });
        return false;
      }
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      const statusResult = await bridgeRef.current.startBatchSession(SHAPE_NODE_TYPE, activeNodeId, payloads, policy);
      const nextStatus = statusResult.status === 'completed'
        ? 'completed'
        : statusResult.status === 'failed'
          ? 'failed'
          : 'processing';
      await persistDraftPatch({ processingStatus: nextStatus });
      console.log('[ShapeBuildProgressStep] start requested', {
        nodeId: String(activeNodeId),
        policy,
        status: statusResult.status,
        payloadCount: payloads.length,
        elapsedMs: Date.now() - startAt,
      });
      return true;
    } catch (error) {
      releaseBuildLock();
      coordinator.clearActiveSessionId(String(activeNodeId));
      notify.error('Failed to start or resume build.');
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [
    activeNodeId,
    buildStatus,
    buildDownloadTaskPayloads,
    canResume,
    canStartOrResumeNow,
    coordinator,
    data?.processingStatus,
    heartbeatFresh,
    lockState,
    persistDraftPatch,
    releaseBuildLock,
    runtimeStatus,
    saveDraftBeforeBatch,
    tryAcquireBuildLock,
  ]);

  const handlePause = useCallback(async (reason: 'route-leave' | 'user-pause' = 'user-pause'): Promise<void> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    if (isPausePending) return;
    setIsPausePending(true);
    try {
      await bridgeRef.current.initialize();
      await bridgeRef.current.pauseBatchSession(SHAPE_NODE_TYPE, activeNodeId, reason);
      await persistDraftPatch({ processingStatus: 'paused', stopReason: reason });
      setIsPausePending(false);
    } catch (error) {
      setIsPausePending(false);
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
    }
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
    isLockSupported: isWebLockSupported,
  });

  useEffect(() => {
    if (!lockRef.current) return;
    if (buildStatus === 'running' || runtimeStatus === 'processing' || isStartPending) return;
    if (shouldMonitor) return;
    releaseBuildLock();
  }, [buildStatus, isStartPending, releaseBuildLock, runtimeStatus, shouldMonitor]);
  const effectiveBuildStatus: BuildStatus = buildStatus;
  const effectiveStatusLabel = isStartPending && buildStatus === 'idle'
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
    warningMessage,
    canStartOrResume: canStartOrResume && canStartOrResumeNow,
    handleStartOrResume: startOrResume,
    handlePause,
    isPausePending,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
    totalElapsedMs: timingSnapshot.totalMs,
    stageElapsedMs: timingSnapshot.stageMs,
    stageRemainingMs: progressSummary.stageRemainingMs,
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: closeCrashSuspect,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: closeSuspendSuspect,
  };
};
