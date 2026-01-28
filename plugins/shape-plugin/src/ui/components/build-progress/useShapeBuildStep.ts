import { createElement, useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeId, NodeType, TaskStage } from '@hierarchidb/common-types';
import { useShapeBuildTasks } from './useShapeBuildTasks.ts';
import { useBuildProgress } from './useBuildProgress.js';
import { useTranslation } from '../../i18n.js';
import {
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '../../../common/types/index.js';
import type { BuildStage } from '@hierarchidb/components';
import { useBuildTaskProgress } from '@hierarchidb/ui-batch-progress';
import type { BuildStatus } from '@hierarchidb/components';
import {
  buildStageTaskSummary,
  buildTaskCountSummary,
  computePercentage,
} from './shapeBuildProgressUtils.ts';
import { isSkippedMessage } from '../../../common/utils/taskMessages.ts';
import { getBuildMonitorKey } from '@hierarchidb/ui-monitoring';
import { useShapeBuildTiming } from './useShapeBuildTiming.ts';
import { useShapeBuildTileSummary } from './useShapeBuildTileSummary.ts';
import { useShapeBuildAutoResume } from './useShapeBuildAutoResume.ts';
import {
  CloudDownload as CloudDownloadIcon,
  Tune as TuneIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { FetchTaskPayload } from '../../../common/types/index.js';
import { loadTreeConsoleSettings } from '@hierarchidb/util';
import type { AuthProviderType } from '@hierarchidb/ui-auth';

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
  const stages = useMemo<BuildStage[]>(() => ([
    {
      id: 'fetch',
      title: t('processing.fetch.title', 'Fetch'),
      description: t('stage.stages.fetch.description', 'Fetch and normalize source data.'),
      icon: createElement(CloudDownloadIcon, { color: 'primary' }),
    },
    {
      id: 'transform',
      title: t('processing.transform.title', 'Transform'),
      description: t('stage.stages.transform.description', 'Simplify features per zoom band.'),
      icon: createElement(TuneIcon, { color: 'primary' }),
    },
    {
      id: 'vt',
      title: t('processing.vt.title', 'VT Generation'),
      description: t('stage.stages.vt.description', 'Generate vector tiles for the selected zoom range.'),
      icon: createElement(LayersIcon, { color: 'primary' }),
    },
  ]), [t]);
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
  const statusLabel = useMemo(() => {
    switch (buildStatus) {
      case 'running':
        return t('stage.status.running', 'Build in progress');
      case 'paused':
        return t('stage.status.paused', 'Build paused');
      case 'completed':
        return t('stage.status.completed', 'Build completed');
      case 'failed':
        return t('stage.status.failed', 'Build failed');
      default:
        return t('stage.status.ready', 'Ready to start stage');
    }
  }, [buildStatus, t]);
  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const taskType = effectiveProgress?.taskType;
  const resolvedTaskType = taskType ?? effectiveStatus?.stage ?? stages[0]?.id;
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const warningMessage = useMemo(() => {
    if (buildStatus !== 'paused') return null;
    const message = effectiveStatus?.error;
    if (typeof message !== 'string') return null;
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [buildStatus, effectiveStatus?.error]);
  const completed = effectiveProgress?.completed ?? 0;
  const total = effectiveProgress?.total ?? 0;
  const failed = effectiveProgress?.failed ?? 0;
  const skipped = effectiveProgress?.skipped ?? 0;
  const debugStateRef = useRef<Record<string, unknown> | null>(null);
  const lastStableCountsRef = useRef<{ total: number; completed: number; failed: number; skipped: number; percentage: number } | null>(null);
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

  const taskSummary = useMemo(() => (
    buildStageTaskSummary(
      displayTasks,
      normalizeStageKey,
      (task) => isSkippedMessage(task.message),
    )
  ), [displayTasks]);
  const aggregatedCounts = useMemo(() => (
    buildTaskCountSummary(displayTasks, (task) => isSkippedMessage(task.message))
  ), [displayTasks]);
  const hasProgressData = Boolean(effectiveProgress)
    || Boolean(effectiveStatus && effectiveStatus.status !== 'idle')
    || displayTasks.length > 0;
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
      byStage: taskSummary,
    });
    if (snapshot === lastTaskSummaryRef.current) return;
    lastTaskSummaryRef.current = snapshot;
    console.debug('[ShapeBuildStep] taskSummary', JSON.parse(snapshot));
  }, [displayTasks.length, taskSummary]);
  const { stageProgress, tasksByStage, paneProgress } = useBuildTaskProgress(
    stages,
    resolvedTaskType,
    overallProgress,
    buildStatus,
    displayTasks,
  );
  const paneProgressWithSummary = useMemo(() => {
    const failureStageId = buildStatus === 'failed'
      ? taskType
      : undefined;
    return stages.map((stage) => {
      const base = paneProgress?.find((entry) => entry.paneId === stage.id);
      const inlineSummary = taskSummary[stage.id];
      const resolvedSummary = inlineSummary
        ? {
          total: inlineSummary.total,
          success: inlineSummary.completed,
          error: inlineSummary.failed,
          skip: inlineSummary.skipped,
        }
        : null;
      const hasSummaryData = Boolean(
        resolvedSummary
        && ((resolvedSummary.total ?? 0) > 0
          || (resolvedSummary.success ?? 0) > 0
          || (resolvedSummary.error ?? 0) > 0
          || (resolvedSummary.skip ?? 0) > 0),
      );
      const progressSummary = (!hasSummaryData && stage.id === resolvedTaskType && (effectiveProgress?.total ?? 0) > 0)
        ? {
          total: effectiveProgress?.total ?? 0,
          success: effectiveProgress?.completed ?? 0,
          error: effectiveProgress?.failed ?? 0,
          skip: effectiveProgress?.skipped ?? 0,
          percentage: effectiveProgress?.percentage,
        }
        : null;
      let total = hasSummaryData
        ? (resolvedSummary?.total ?? 0)
        : progressSummary
          ? progressSummary.total
          : (base?.taskCount ?? 0);
      const success = hasSummaryData
        ? (resolvedSummary?.success ?? 0)
        : progressSummary
          ? progressSummary.success
          : (base?.completedCount ?? 0);
      let error = hasSummaryData
        ? (resolvedSummary?.error ?? 0)
        : progressSummary
          ? progressSummary.error
          : 0;
      const skip = hasSummaryData
        ? (resolvedSummary?.skip ?? 0)
        : progressSummary
          ? progressSummary.skip
          : 0;
      if (failureStageId && stage.id === failureStageId) {
        error = Math.max(error, 1);
        total = Math.max(total, error + success + skip);
      }
      const done = Math.min(total, success + error + skip);
      const progressValue = total > 0
        ? Math.round((done / total) * 100)
        : progressSummary?.percentage ?? (base?.progress ?? 0);
      const status = error > 0
        ? 'failed'
        : total > 0 && success + skip >= total
          ? 'completed'
          : total > 0
            ? 'running'
            : (base?.status ?? buildStatus);
      return {
        paneId: stage.id,
        progress: progressValue,
        taskCount: total,
        completedCount: success,
        status,
        summary: { total, success, error, skip },
      };
    });
  }, [effectiveProgress, buildStatus, paneProgress, resolvedTaskType, stages, taskType, taskSummary]);
  const lastUnfinishedStageId = useMemo(() => {
    if (buildStatus !== 'running') return undefined;
    let candidate: string | undefined;
    stages.forEach((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.length === 0) return;
      const hasIncomplete = stageTasks.some((task) => task.status !== 'completed');
      if (hasIncomplete) {
        candidate = stage.id;
      }
    });
    return candidate;
  }, [buildStatus, stages, tasksByStage]);
  const displayStageId = lastUnfinishedStageId ?? resolvedTaskType;
  const displayStageLabel = (() => {
    if (displayStageId) {
      return stages.find((stage) => stage.id === displayStageId)?.title
        ?? displayStageId;
    }
    if (buildStatus === 'running') {
      return t('stage.progress.unknownStage', 'processing');
    }
    if (buildStatus === 'paused') {
      return t('stage.progress.pausedStage', 'paused');
    }
    if (buildStatus === 'completed') {
      return t('stage.progress.completedStage', 'completed');
    }
    return t('stage.progress.idleStage', 'idle');
  })();
  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageTasks = tasksByStage[lastUnfinishedStageId] ?? [];
    if (!stageTasks.length) return null;
    return buildTaskCountSummary(stageTasks, (task) => isSkippedMessage(task.message));
  }, [lastUnfinishedStageId, tasksByStage]);
  const rawDisplayCounts = useMemo(() => {
    if (total === 0 && completed === 0 && failed === 0 && skipped === 0 && aggregatedCounts.total > 0) {
      return {
        ...aggregatedCounts,
        percentage: computePercentage(aggregatedCounts),
      };
    }
    if (buildStatus === 'running' && total === 0 && completed === 0 && failed === 0 && skipped === 0 && derivedCounts?.total) {
      return {
        ...derivedCounts,
        percentage: computePercentage(derivedCounts),
      };
    }
    const baseCounts = { total, completed, failed, skipped };
    return {
      ...baseCounts,
      percentage: total > 0 ? computePercentage(baseCounts) : Math.round(overallProgress),
    };
  }, [aggregatedCounts, buildStatus, completed, derivedCounts, failed, overallProgress, skipped, total]);
  useEffect(() => {
    if (rawDisplayCounts.total > 0) {
      lastStableCountsRef.current = rawDisplayCounts;
    }
  }, [rawDisplayCounts]);
  const displayCounts = useMemo(() => {
    if (buildStatus === 'running' && rawDisplayCounts.total === 0 && hasProgressData) {
      return lastStableCountsRef.current ?? rawDisplayCounts;
    }
    return rawDisplayCounts;
  }, [hasProgressData, buildStatus, rawDisplayCounts]);

  const taskLabel = (() => {
    if (buildStatus === 'completed') {
      return t('stage.progress.done', 'Completed');
    }
    if (buildStatus === 'failed') {
      return t('stage.progress.failed', 'Failed');
    }
    if (buildStatus === 'paused') {
      return t('stage.progress.paused', 'Paused');
    }
    if (buildStatus !== 'running') {
      if (buildStatus === 'idle' && rawDisplayCounts.total > 0) {
        const doneCount = rawDisplayCounts.completed + rawDisplayCounts.failed + rawDisplayCounts.skipped;
        return doneCount >= rawDisplayCounts.total
          ? t('stage.progress.done', 'Completed')
          : t('stage.progress.working', 'Working...');
      }
      if (effectiveStatus?.error) return effectiveStatus.error;
      if (effectiveProgress?.message) return effectiveProgress.message;
      return t('stage.progress.ready', 'Ready');
    }
    return effectiveProgress?.message
      ?? (resolvedTaskType ? stages.find((stage) => stage.id === resolvedTaskType)?.title ?? resolvedTaskType : undefined)
      ?? effectiveStatus?.error
      ?? t('stage.progress.working', 'Working...');
  })();
  const taskUnitLabel = t('stage.progress.taskUnitTasks', 'Tasks');

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

  const stageRemainingMs = useMemo(() => {
    if (!resolvedTaskType) return null;
    const stageTasks = tasksByStage[resolvedTaskType] ?? [];
    if (!stageTasks.length) return null;
    const counts = buildTaskCountSummary(stageTasks, (task) => isSkippedMessage(task.message));
    const done = counts.completed + counts.failed + counts.skipped;
    const remaining = counts.total - done;
    if (remaining <= 0 || done <= 0) return null;
    const avgPerTaskMs = timingSnapshot.stageMs / done;
    if (!Number.isFinite(avgPerTaskMs) || avgPerTaskMs <= 0) return null;
    return Math.max(0, Math.round(avgPerTaskMs * remaining));
  }, [resolvedTaskType, tasksByStage, timingSnapshot.stageMs]);

  return {
    t,
    stages,
    stageProgress,
    paneProgress: paneProgressWithSummary,
    tasksByStage,
    tasks: displayTasks,
    isTasksLoading,
    isTaskSummaryLoading,
    buildStatus: effectiveBuildStatus,
    overallProgress: displayCounts.percentage,
    stageLabel: displayStageLabel,
    taskLabel,
    taskUnitLabel,
    statusLabel: effectiveStatusLabel,
    completed: displayCounts.completed,
    total: displayCounts.total,
    failed: displayCounts.failed,
    skipped: displayCounts.skipped,
    hasProgressData,
    warningMessage,
    canStartOrResume,
    handleStartOrResume: startOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
    totalElapsedMs: timingSnapshot.totalMs,
    stageElapsedMs: timingSnapshot.stageMs,
    stageRemainingMs,
  };
};
