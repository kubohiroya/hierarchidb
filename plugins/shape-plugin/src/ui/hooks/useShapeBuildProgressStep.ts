import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { useShapeBatchTasks } from './useShapeBatchTasks.js';
import { useShapeProgress } from './useShapeProgress.js';
import { useTranslation } from '../i18n.js';
import { useAtom } from 'jotai';
import { shapeBuildPersistedTasksAtom } from '../state/shapeBuildProgressAtoms.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeBatchConfig,
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '../../common/types/index.js';
import { useBuildStages } from './build/useBuildStages.js';
import { useBuildStatus } from './build/useBuildStatus.js';
import { useBuildTaskProgress } from '@hierarchidb/ui-batch';
import { useBatchSessionActions } from './build/useBatchSessionActions.js';
import { getShapeRuntimeWorkerClient } from '../../services/batch/adapters/RuntimeWorkerClient.js';
import {
  appendBuildSample,
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  getBuildMonitorKey,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
} from '@hierarchidb/ui-monitoring';
import { getBuildConfigSnapshot } from '../utils/buildWarnings.js';

const normalizeStageId = (stage?: string): string | undefined => {
  if (!stage) return undefined;
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const buildMonitorConfig = {
  storagePrefix: 'hdb:shape:build-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
} as const;

const fetchTileSummary = async (nodeId: string) => {
  const client = await getShapeRuntimeWorkerClient();
  const vectorTile = client?.vectortile;
  if (!vectorTile?.getSummary) return { tiles: 0, totalBytes: 0 };
  return vectorTile.getSummary(nodeId);
};

type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: NodeId;
};

export const useShapeBuildProgressStep = ({ data, onChange, nodeId }: Args) => {
  const { t } = useTranslation();
  const activeNodeId = nodeId ?? data?.nodeId ?? null;

  const { progress, status, error, isSubscribed } = useShapeProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });
  const [persistedTasks, setPersistedTasks] = useAtom(shapeBuildPersistedTasksAtom);
  const [isStartPending, setIsStartPending] = useState(false);
  const hasNodeId = Boolean(activeNodeId && !error);
  const effectiveProgress = hasNodeId ? progress : null;
  const effectiveStatus = hasNodeId ? status : null;
  const stages = useBuildStages();
  const { buildStatus, statusLabel, effectiveStatus: resolvedStatus } = useBuildStatus(effectiveStatus);
  const shouldPollTasks = Boolean(activeNodeId)
    && buildStatus !== 'idle'
    && buildStatus !== 'completed'
    && buildStatus !== 'failed';
  const shouldPollTasksRef = useCallback(() => shouldPollTasks, [shouldPollTasks]);
  const { tasks, refresh: refreshTasks } = useShapeBatchTasks(activeNodeId, {
    autoRefresh: shouldPollTasksRef,
    pollIntervalMs: 2000,
  });
  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const currentStage = normalizeStageId(effectiveProgress?.currentStage);
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const taskLabel = (() => {
    if (buildStatus === 'completed') {
      return t('build.progress.done', 'Completed');
    }
    if (buildStatus === 'failed') {
      return t('build.progress.failed', 'Failed');
    }
    if (buildStatus === 'paused') {
      return t('build.progress.paused', 'Paused');
    }
    if (buildStatus !== 'running') {
      if (effectiveStatus?.error) return effectiveStatus.error;
      if (effectiveProgress?.currentTask && effectiveProgress.currentTask !== 'processing' && effectiveProgress.currentTask !== activeNodeId) {
        return effectiveProgress.currentTask;
      }
      return t('build.progress.ready', 'Ready');
    }
    return effectiveProgress?.currentTask
      ?? effectiveStatus?.error
      ?? t('build.progress.working', 'Working...');
  })();
  const warningMessage = useMemo(() => {
    if (buildStatus !== 'paused') return null;
    return effectiveStatus?.error ?? null;
  }, [buildStatus, effectiveStatus?.error]);
  const completed = effectiveProgress?.completed ?? 0;
  const total = effectiveProgress?.total ?? 0;
  const failed = effectiveProgress?.failed ?? 0;
  const skipped = effectiveProgress?.skipped ?? 0;
  const hasProgressData = Boolean(effectiveProgress) || Boolean(effectiveStatus && effectiveStatus.status !== 'idle');
  const debugStateRef = useRef<Record<string, unknown> | null>(null);
  const lastSyncedStatusRef = useRef<string | null>(null);
  const monitorKey = useMemo(() => {
    const resolvedNodeId = nodeId ?? data?.nodeId;
    return getBuildMonitorKey(buildMonitorConfig, resolvedNodeId ? String(resolvedNodeId) : null);
  }, [data?.nodeId, nodeId]);
  const configSnapshot = useMemo(
    () => getBuildConfigSnapshot(data?.batchConfig),
    [data?.batchConfig],
  );

  useEffect(() => {
    const nextState = {
      nodeId: activeNodeId,
      hasNodeId,
      buildStatus,
      status: effectiveStatus?.status ?? null,
      progress: effectiveProgress?.percentage ?? null,
      currentStage: currentStage ?? null,
      currentTask: effectiveProgress?.currentTask ?? null,
      isSubscribed,
      error: error?.message ?? null,
    };
    const prev = debugStateRef.current;
    const entries = Object.entries(nextState) as Array<[keyof typeof nextState, unknown]>;
    const hasChanged = !prev || entries.some(([key, value]) => (prev as typeof nextState)[key] !== value);
    if (hasChanged) {
      console.debug('[ShapeBuildProgressStep] state', nextState);
      debugStateRef.current = nextState;
    }
  }, [
    activeNodeId,
    hasNodeId,
    buildStatus,
    effectiveStatus?.status,
    effectiveProgress?.percentage,
    effectiveProgress?.currentTask,
    currentStage,
    isSubscribed,
    error?.message,
  ]);

  useEffect(() => {
    if (!shouldPollTasksRef()) return;
    void refreshTasks();
  }, [refreshTasks, shouldPollTasksRef]);

  useEffect(() => {
    if (!activeNodeId) {
      setPersistedTasks([]);
      return;
    }
    if (tasks.length > 0) {
      setPersistedTasks(tasks);
    }
  }, [activeNodeId, tasks]);

  useEffect(() => {
    if (!activeNodeId || !effectiveStatus?.status) return;
    const nextStatus = (() => {
      switch (effectiveStatus.status) {
        case 'processing':
          return 'processing';
        case 'paused':
          return 'paused';
        case 'completed':
          return 'completed';
        case 'failed':
          return 'failed';
        case 'idle':
          return 'idle';
        default:
          return undefined;
      }
    })();
    if (!nextStatus) return;
    if (data?.processingStatus === nextStatus) return;
    if (lastSyncedStatusRef.current === nextStatus) return;
    lastSyncedStatusRef.current = nextStatus;
    onChange({ processingStatus: nextStatus });
  }, [data?.processingStatus, effectiveStatus?.status, onChange, activeNodeId]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (data?.buildStartedAt) return;
    onChange({
      buildStartedAt: Date.now(),
      buildFinishedAt: undefined,
    });
  }, [buildStatus, data?.buildStartedAt, onChange]);

  useEffect(() => {
    if (!monitorKey) return;
    if (buildStatus !== 'running') return;
    const startedAt = data?.buildStartedAt ?? Date.now();
    recordBuildStart(buildMonitorConfig, monitorKey, {
      nodeId: data?.nodeId ? String(data.nodeId) : undefined,
      startedAt,
      configSnapshot,
    });
    const interval = window.setInterval(() => {
      appendBuildSample(buildMonitorConfig, monitorKey, {
        timestamp: Date.now(),
        stage: currentStage as 'download' | 'simplify1' | 'simplify2' | 'vectorTiles' | undefined,
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [buildStatus, configSnapshot, currentStage, data?.buildStartedAt, data?.nodeId, monitorKey]);

  useEffect(() => {
    if (!monitorKey) return;
    if (!['completed', 'failed'].includes(buildStatus)) return;
    if (!data?.buildFinishedAt) {
      onChange({ buildFinishedAt: Date.now() });
    }
    recordBuildFinish(buildMonitorConfig, monitorKey, Date.now());
  }, [buildStatus, data?.buildFinishedAt, monitorKey, onChange]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!['running', 'completed'].includes(buildStatus)) return;
    if ((data?.tileSummary?.tiles ?? 0) > 0) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await fetchTileSummary(activeNodeId);
        if (cancelled) return;
        if (summary.tiles > 0) {
          onChange({ tileSummary: summary });
        }
      } catch (error) {
        console.debug('[ShapeBuildProgressStep] tile summary load failed', error);
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, buildStatus, data?.tileSummary?.tiles, onChange]);

  useEffect(() => {
    if (!isStartPending) return;
    if (buildStatus !== 'idle') {
      setIsStartPending(false);
    }
  }, [buildStatus, isStartPending]);

  const displayTasks = tasks.length > 0 ? tasks : persistedTasks;
  const { stageProgress, tasksByStage, paneProgress } = useBuildTaskProgress(
    stages,
    currentStage,
    overallProgress,
    buildStatus,
    displayTasks,
  );
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
  const displayStageId = lastUnfinishedStageId ?? currentStage;
  const displayStageLabel = (() => {
    if (displayStageId) {
      return stages.find((stage) => stage.id === displayStageId)?.title
        ?? displayStageId;
    }
    if (buildStatus === 'running') {
      return t('build.progress.unknownStage', 'processing');
    }
    if (buildStatus === 'paused') {
      return t('build.progress.pausedStage', 'paused');
    }
    if (buildStatus === 'completed') {
      return t('build.progress.completedStage', 'completed');
    }
    return t('build.progress.idleStage', 'idle');
  })();
  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageTasks = tasksByStage[lastUnfinishedStageId] ?? [];
    if (!stageTasks.length) return null;
    const completedCount = stageTasks.filter((task) => task.status === 'completed' && task.message !== 'skipped').length;
    const failedCount = stageTasks.filter((task) => task.status === 'failed').length;
    const skippedCount = stageTasks.filter((task) => task.message === 'skipped').length;
    return {
      total: Math.max(0, stageTasks.length - skippedCount),
      completed: completedCount,
      failed: failedCount,
      skipped: skippedCount,
    };
  }, [lastUnfinishedStageId, tasksByStage]);
  const displayCounts = useMemo(() => {
    if (buildStatus === 'running' && total === 0 && completed === 0 && failed === 0 && skipped === 0 && derivedCounts?.total) {
      return {
        ...derivedCounts,
        percentage: Math.round((derivedCounts.completed / derivedCounts.total) * 100),
      };
    }
    return {
      total,
      completed,
      failed,
      skipped,
      percentage: Math.round(overallProgress),
    };
  }, [buildStatus, completed, derivedCounts, failed, overallProgress, skipped, total]);

  const isProcessingValid = useMemo(() => (
    validateBatchConfig(
      mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
    ).isValid
  ), [data?.batchConfig]);
  const hasSelection = summarizeCheckboxState(selectedArrayByCountries).hasSelection;
  const hasDataSource = Boolean(data?.batchConfig?.dataSource ?? data?.dataSourceName);
  const canStartOrResume = !isStartPending && buildStatus !== 'running'
    && hasDataSource
    && hasSelection
    && isProcessingValid;

  const {
    handleStartOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  } = useBatchSessionActions({
    nodeType: SHAPE_NODE_TYPE,
    nodeId: activeNodeId ?? undefined,
    data,
    onChange,
    buildStatus,
  });
  const startOrResume = useCallback(async () => {
    if (isStartPending) return;
    setIsStartPending(true);
    const ok = await handleStartOrResume();
    if (!ok) {
      setIsStartPending(false);
    }
  }, [handleStartOrResume, isStartPending]);
  const effectiveBuildStatus = isStartPending ? 'running' : buildStatus;
  const effectiveStatusLabel = isStartPending && buildStatus === 'idle'
    ? t('build.status.starting', 'Starting build...')
    : statusLabel;

  return {
    t,
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    tasks: displayTasks,
    buildStatus: effectiveBuildStatus,
    overallProgress: displayCounts.percentage,
    stageLabel: displayStageLabel,
    taskLabel,
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
  };
};
