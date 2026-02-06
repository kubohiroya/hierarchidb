import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  createPollingTracker,
  createSessionCoordinator,
  type SessionChannelMessage,
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
import { useShapeBuildTileSummary } from './useShapeBuildTileSummary.ts';
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
  const activeNodeId = nodeId ?? data?.nodeId ?? null;
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastBroadcastAtRef = useRef<number | null>(null);
  const lastBroadcastTabIdRef = useRef<string | null>(null);
  const lastAckAtRef = useRef<number | null>(null);
  const lastAckTabIdRef = useRef<string | null>(null);
  const tabStateRef = useRef<Map<string, { state: 'active' | 'hidden' | 'frozen'; at: number }>>(new Map());
  const pollingTrackerRef = useRef(createPollingTracker({ quietThresholdTimeout: coordinator.quietThresholdTimeout }));
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;

  const [isPausePending, setIsPausePending] = useState(false);
  const [remoteProgress, setRemoteProgress] = useState<BuildProgress | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<BuildProgressStatus | null>(null);
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<number | null>(null);
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
  const tasksCompletionStatus = useMemo<BuildStatus | null>(() => {
    if (displayTasks.length === 0) return null;
    if (hasInFlightTasks) return null;
    const hasFailed = displayTasks.some((task) => task.status === 'failed');
    return hasFailed ? 'failed' : 'completed';
  }, [displayTasks, hasInFlightTasks]);
  const buildStatus = useMemo<BuildStatus>(() => {
    if (tasksCompletionStatus) {
      return tasksCompletionStatus;
    }
    if (baseBuildStatus === 'completed' && hasInFlightTasks) {
      return 'running';
    }
    return baseBuildStatus;
  }, [baseBuildStatus, hasInFlightTasks, tasksCompletionStatus]);
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
  const monitorKey = useMemo(() => {
    const resolvedNodeId = nodeId ?? data?.nodeId;
    return getBuildMonitorKey({ storagePrefix: 'hdb:shape:stage-monitor', maxSamples: 3, memoryPressureRatio: 0.85, heapWarningRatio: 0.85, heapCriticalRatio: 0.9 }, resolvedNodeId ? String(resolvedNodeId) : null);
  }, [data?.nodeId, nodeId]);
  const { timingSnapshot } = useShapeBuildTiming({
    buildStatus,
    taskType,
    resolvedTaskType,
    data,
    nodeId,
    monitorKey,
    onChange,
  });

  useShapeBuildTileSummary({
    activeNodeId,
    buildStatus,
    data,
    onChange,
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
          ...(data ?? {}),
          ...(patch ?? {}),
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
          ...(data ?? {}),
          ...patch,
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
    const semaphoreKey = `shape:${activeNodeId}`;
    const acquired = await coordinator.tryAcquireSemaphore(semaphoreKey, tabIdRef.current, coordinator.semaphoreTtlTimeout);
    if (!acquired) return;
    lastAutoResumeAtRef.current = now;
    coordinator.writeActiveSessionId(String(activeNodeId));
    try {
      await bridgeRef.current.initialize();
      const status = await bridgeRef.current.getBatchSessionStatus(SHAPE_NODE_TYPE, activeNodeId);
      if (status.status !== 'running') return;
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, activeNodeId, policy);
      await persistDraftPatch({ processingStatus: 'processing' });
    } catch (error) {
      coordinator.clearActiveSessionId(String(activeNodeId));
      notify.error('Failed to auto-resume build.');
      console.error('[ShapeBuildProgressStep] auto-resume failed', error);
    }
  }, [activeNodeId, buildStatus, coordinator, getRecentNonActiveState, persistDraftPatch, runtimeStatus]);

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
  }, [activeNodeId, buildStatus, coordinator, progress, status]);

  useEffect(() => {
    if (!activeNodeId) return;
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

  const canResume = buildStatus === 'paused';
  const handleStartOrResume = useCallback(async (options?: { forceRestart?: boolean; autoResume?: boolean }): Promise<boolean> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== String(activeNodeId)) {
      notify.info('Another build session is active in this tab.');
      return false;
    }
    coordinator.writeActiveSessionId(String(activeNodeId));
    // autoResumeBuild is only set by route transitions (build=1). Avoid writing on manual clicks.
    if (canResume && !options?.forceRestart) {
      try {
        await bridgeRef.current.initialize();
        const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
        await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, activeNodeId, policy);
        await persistDraftPatch({ processingStatus: 'processing' });
        return true;
      } catch (error) {
        coordinator.clearActiveSessionId(String(activeNodeId));
        notify.error('Failed to resume build.');
        console.error('[ShapeBuildProgressStep] resume failed', error);
        return false;
      }
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      coordinator.clearActiveSessionId(String(activeNodeId));
      return false;
    }
    try {
      await bridgeRef.current.initialize();
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads || payloads.length === 0) {
        coordinator.clearActiveSessionId(String(activeNodeId));
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
      return true;
    } catch (error) {
      coordinator.clearActiveSessionId(String(activeNodeId));
      notify.error('Failed to start or resume build.');
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [activeNodeId, buildStatus, buildDownloadTaskPayloads, canResume, coordinator, persistDraftPatch, saveDraftBeforeBatch]);

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
  });
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
    canStartOrResume,
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
