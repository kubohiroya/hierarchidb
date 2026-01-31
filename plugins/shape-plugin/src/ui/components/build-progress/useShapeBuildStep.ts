import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
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
  const activeNodeId = nodeId ?? data?.nodeId ?? null;

  const { progress, status, error } = useBuildProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const warnedSkippedTasksRef = useRef<Set<string>>(new Set());
  const hasNodeId = Boolean(activeNodeId && !error);
  const effectiveProgress = hasNodeId ? progress : null;
  const effectiveStatus = hasNodeId ? status : null;
  const stages = useShapeBuildStages(t);
  const processingStatus = data?.processingStatus ?? 'idle';
  const runtimeStatus = effectiveStatus?.status ?? null;
  const statusSource = runtimeStatus ?? processingStatus;
  const baseBuildStatus = useMemo<BuildStatus>(() => (
    toBuildStatus(statusSource)
  ), [statusSource]);
  const { tasks, isLoading: isTasksLoading } = useShapeBuildTasks(activeNodeId);
  const isTaskSummaryLoading = false;
  const displayTasks = tasks;
  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);
  const buildStatus = useMemo<BuildStatus>(() => {
    if (baseBuildStatus === 'completed' && hasInFlightTasks) {
      return 'running';
    }
    return baseBuildStatus;
  }, [baseBuildStatus, hasInFlightTasks]);
  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const taskType = effectiveProgress?.taskType;
  const resolvedTaskType = taskType ?? effectiveStatus?.stage ?? stages[0]?.id;
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const debugStateRef = useRef<Record<string, unknown> | null>(null);
  const monitorKey = useMemo(() => {
    const resolvedNodeId = nodeId ?? data?.nodeId;
    return getBuildMonitorKey({ storagePrefix: 'hdb:shape:stage-monitor', maxSamples: 3, memoryPressureRatio: 0.85, heapWarningRatio: 0.85, heapCriticalRatio: 0.9 }, resolvedNodeId ? String(resolvedNodeId) : null);
  }, [data?.nodeId, nodeId]);
  useEffect(() => {
    const nextState = {
      nodeId: activeNodeId,
      hasNodeId,
      buildStatus: buildStatus,
      progress: effectiveProgress?.percentage ?? null,
      taskType: taskType ?? null,
      message: effectiveProgress?.message ?? null,
      error: error?.message ?? null,
    };
    const prev = debugStateRef.current;
    const entries = Object.entries(nextState) as Array<[keyof typeof nextState, unknown]>;
    const hasChanged = !prev || entries.some(([key, value]) => (prev as typeof nextState)[key] !== value);
    if (hasChanged) {
      console.debug('[ShapeBuildStep] atoms', nextState);
      debugStateRef.current = nextState;
    }
  }, [
    activeNodeId,
    hasNodeId,
    buildStatus,
    effectiveProgress?.percentage,
    effectiveProgress?.message,
    taskType,
    error?.message,
  ]);

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
  useEffect(() => {
    if (displayTasks.length === 0) return;
    const warned = warnedSkippedTasksRef.current;
    for (const task of displayTasks) {
      if (!task.taskId || !isSkippedMessage(task.message)) continue;
      if (warned.has(task.taskId)) continue;
      warned.add(task.taskId);
      console.info(
        `[ShapeBuildStep] skipped taskId=${task.taskId} stage=${normalizeStageKey(task)} message=${task.message}`
      );
    }
  }, [displayTasks]);
  const lastTaskSummaryRef = useRef<string | null>(null);
  useEffect(() => {
    if (displayTasks.length === 0) return;
    const snapshot = JSON.stringify({
      total: displayTasks.length,
      byStage: progressSummary.taskSummary,
    });
    if (snapshot === lastTaskSummaryRef.current) return;
    lastTaskSummaryRef.current = snapshot;
    console.debug('[ShapeBuildStep] taskSummary', JSON.parse(snapshot));
  }, [displayTasks.length, progressSummary.taskSummary]);
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
  const debugScope = '[ShapeBuildStep]';
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

  const saveDraftBeforeBatch = useCallback(async (patch?: Partial<ShapeEntity>) => {
    console.debug(`${debugScope} saveDraftBeforeBatch:start`, {
      nodeId: activeNodeId,
      hasWorkerClient: Boolean(workerClient),
      buildStatus,
    });
    if (!activeNodeId) {
      console.debug(`${debugScope} saveDraftBeforeBatch:missingNodeId`);
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      console.debug(`${debugScope} saveDraftBeforeBatch:missingWorkerClient`);
      notify.error('Worker client is unavailable.');
      return false;
    }
    const baseBatchConfig = {
      ...(data?.buildConfig ?? {}),
      ...(patch?.buildConfig ?? {}),
    };
    try {
      console.debug(`${debugScope} saveDraftBeforeBatch:updateDraft`, {
        nodeId: activeNodeId,
        dataSourceName: baseBatchConfig.dataSourceName ?? null,
      });
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
      console.debug(`${debugScope} saveDraftBeforeBatch:complete`, {
        nodeId: activeNodeId,
        dataSourceName: baseBatchConfig.dataSourceName ?? null,
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
    console.debug(`${debugScope} startOrResume:click`, {
      nodeId: activeNodeId,
      buildStatus,
      forceRestart: options?.forceRestart ?? false,
      autoResume: options?.autoResume ?? false,
    });
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    // autoResumeBuild is only set by route transitions (build=1). Avoid writing on manual clicks.
    if (canResume && !options?.forceRestart) {
      try {
        await bridgeRef.current.initialize();
        const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
        await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, activeNodeId, policy);
        await persistDraftPatch({ processingStatus: 'processing' });
        return true;
      } catch (error) {
        notify.error('Failed to resume build.');
        console.error('[ShapeBuildProgressStep] resume failed', error);
        return false;
      }
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      console.debug(`${debugScope} startOrResume:saveDraftFailed`);
      return false;
    }
    try {
      await bridgeRef.current.initialize();
      console.debug(`${debugScope} startOrResume:bridgeReady`);
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads || payloads.length === 0) {
        console.debug(`${debugScope} startOrResume:missingPayloads`, { nodeId: activeNodeId });
        return false;
      }
      console.debug(`${debugScope} startOrResume:startBatch`, {
        nodeId: activeNodeId,
        nodeType: SHAPE_NODE_TYPE,
        payloadCount: payloads.length,
      });
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      const statusResult = await bridgeRef.current.startBatchSession(SHAPE_NODE_TYPE, activeNodeId, payloads, policy);
      console.debug(`${debugScope} startOrResume:startBatchResult`, statusResult ?? null);
      const nextStatus = statusResult.status === 'completed'
        ? 'completed'
        : statusResult.status === 'failed'
          ? 'failed'
          : 'processing';
      await persistDraftPatch({ processingStatus: nextStatus });
      return true;
    } catch (error) {
      notify.error('Failed to start or resume build.');
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [activeNodeId, buildStatus, buildDownloadTaskPayloads, canResume, persistDraftPatch, saveDraftBeforeBatch]);

  const handlePause = useCallback(async (): Promise<void> => {
    if (!activeNodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    try {
      await bridgeRef.current.initialize();
      await bridgeRef.current.pauseBatchSession(SHAPE_NODE_TYPE, activeNodeId);
      await persistDraftPatch({ processingStatus: 'paused' });
    } catch (error) {
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
    }
  }, [activeNodeId, persistDraftPatch]);
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
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
    totalElapsedMs: timingSnapshot.totalMs,
    stageElapsedMs: timingSnapshot.stageMs,
    stageRemainingMs: progressSummary.stageRemainingMs,
  };
};
