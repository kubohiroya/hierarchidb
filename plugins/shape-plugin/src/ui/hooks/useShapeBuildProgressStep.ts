import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { useShapeBatchTasks } from './useShapeBatchTasks.js';
import { useShapeProgress } from './useShapeProgress.js';
import { useTranslation } from '../i18n.js';
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
import { getTileSummary } from '../../services/tiles/RuntimeTileClient.js';
import {
  appendBuildSample,
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  getBuildConfigSnapshot,
  getBuildMonitorKey,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
} from '../utils/buildMonitor.js';

const normalizeStageId = (stage?: string): string | undefined => {
  if (!stage) return undefined;
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;

type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: NodeId;
};

export const useShapeBuildProgressStep = ({ data, onChange, nodeId }: Args) => {
  const { t } = useTranslation();
  const sessionId = data?.batchSessionId ?? null;

  const { progress, status, error, isSubscribed } = useShapeProgress(sessionId, { autoSubscribe: Boolean(sessionId) });
  const { tasks, refresh: refreshTasks } = useShapeBatchTasks(sessionId, { autoRefresh: true, pollIntervalMs: 2000 });
  const [persistedTasks, setPersistedTasks] = useState<typeof tasks>([]);
  const [isStartPending, setIsStartPending] = useState(false);
  const hasSessionId = Boolean(sessionId && !error);
  const effectiveProgress = hasSessionId ? progress : null;
  const effectiveStatus = hasSessionId ? status : null;
  const stages = useBuildStages();
  const { buildStatus, statusLabel } = useBuildStatus(effectiveStatus);
  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const currentStage = normalizeStageId(effectiveProgress?.currentStage);
  const overallProgress = effectiveProgress?.percentage ?? effectiveStatus?.progress ?? 0;
  const stageLabel = (() => {
    if (currentStage) {
      return stages.find((stage) => stage.id === currentStage)?.title
        ?? currentStage;
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
      if (effectiveProgress?.currentTask && effectiveProgress.currentTask !== 'processing' && effectiveProgress.currentTask !== sessionId) {
        return effectiveProgress.currentTask;
      }
      return t('build.progress.ready', 'Ready');
    }
    return effectiveProgress?.currentTask
      ?? effectiveStatus?.error
      ?? t('build.progress.working', 'Working...');
  })();
  const completed = effectiveProgress?.completed ?? 0;
  const total = effectiveProgress?.total ?? 0;
  const failed = effectiveProgress?.failed ?? 0;
  const skipped = effectiveProgress?.skipped ?? 0;
  const hasProgressData = Boolean(effectiveProgress) || Boolean(effectiveStatus && effectiveStatus.status !== 'idle');
  const debugStateRef = useRef<Record<string, unknown> | null>(null);
  const lastSyncedStatusRef = useRef<string | null>(null);
  const monitorKey = useMemo(() => {
    const resolvedNodeId = nodeId ?? data?.nodeId;
    return getBuildMonitorKey(resolvedNodeId ? String(resolvedNodeId) : null, sessionId);
  }, [data?.nodeId, nodeId, sessionId]);
  const configSnapshot = useMemo(
    () => getBuildConfigSnapshot(data?.batchConfig),
    [data?.batchConfig],
  );

  useEffect(() => {
    const nextState = {
      sessionId,
      hasSessionId,
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
    sessionId,
    hasSessionId,
    buildStatus,
    effectiveStatus?.status,
    effectiveProgress?.percentage,
    effectiveProgress?.currentTask,
    currentStage,
    isSubscribed,
    error?.message,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    void refreshTasks();
  }, [refreshTasks, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setPersistedTasks([]);
      return;
    }
    if (tasks.length > 0) {
      setPersistedTasks(tasks);
    }
  }, [sessionId, tasks]);

  useEffect(() => {
    if (!sessionId || !effectiveStatus?.status) return;
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
        case 'cancelled':
          return 'cancelled';
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
  }, [data?.processingStatus, effectiveStatus?.status, onChange, sessionId]);

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
    recordBuildStart(monitorKey, {
      nodeId: data?.nodeId ? String(data.nodeId) : undefined,
      sessionId: sessionId ?? undefined,
      startedAt,
      configSnapshot,
    });
    const interval = window.setInterval(() => {
      appendBuildSample(monitorKey, {
        timestamp: Date.now(),
        stage: currentStage as 'download' | 'simplify1' | 'simplify2' | 'vectorTiles' | undefined,
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [buildStatus, configSnapshot, currentStage, data?.buildStartedAt, data?.nodeId, monitorKey, sessionId]);

  useEffect(() => {
    if (!monitorKey) return;
    if (!['completed', 'failed', 'cancelled'].includes(buildStatus)) return;
    if (!data?.buildFinishedAt) {
      onChange({ buildFinishedAt: Date.now() });
    }
    recordBuildFinish(monitorKey, Date.now());
  }, [buildStatus, data?.buildFinishedAt, monitorKey, onChange]);

  useEffect(() => {
    if (!sessionId) return;
    if (!['running', 'completed'].includes(buildStatus)) return;
    if ((data?.tileSummary?.tiles ?? 0) > 0) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await getTileSummary(sessionId);
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
  }, [buildStatus, data?.tileSummary?.tiles, onChange, sessionId]);

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

  const resolveStatusLabel = useCallback((statusValue?: string): string => {
    switch (statusValue) {
      case 'running':
        return t('build.taskStatus.running', 'Running');
      case 'completed':
        return t('build.taskStatus.completed', 'Completed');
      case 'failed':
        return t('build.taskStatus.failed', 'Failed');
      case 'cancelled':
        return t('build.taskStatus.cancelled', 'Cancelled');
      case 'paused':
        return t('build.taskStatus.paused', 'Paused');
      case 'queued':
        return t('build.taskStatus.queued', 'Queued');
      default:
        return t('build.taskStatus.waiting', 'Waiting');
    }
  }, [t]);

  const resolveStatusColor = useCallback((statusValue?: string) => {
    switch (statusValue) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
      case 'paused':
        return 'warning';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  }, []);

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

  const { handleStartOrResume, handlePause } = useBatchSessionActions({
    nodeType: SHAPE_NODE_TYPE,
    nodeId,
    sessionId,
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
    overallProgress,
    stageLabel,
    taskLabel,
    statusLabel: effectiveStatusLabel,
    completed,
    total,
    failed,
    skipped,
    hasProgressData,
    canStartOrResume,
    handleStartOrResume: startOrResume,
    handlePause,
    resolveStatusLabel,
    resolveStatusColor,
  };
};
