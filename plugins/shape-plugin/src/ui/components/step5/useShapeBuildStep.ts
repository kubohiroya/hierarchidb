import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toNodeId, type NodeId, type NodeType } from '@hierarchidb/common-types';
import { useShapeBuildTasks } from './useShapeBuildTasks.ts';
import { useBuildProgress } from './useBuildProgress.js';
import { useTranslation } from '../../i18n.js';
import { useAtom } from 'jotai';
import { persistedTasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeBatchConfig,
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '../../../common/types/index.js';
import { useBuildStages } from './useBuildStages.js';
import { useBuildStatus } from './useBuildStatus.js';
import { useBuildTaskProgress } from '@hierarchidb/ui-batch-progress';
import { useBatchSessionActions } from './useBatchSessionActions.js';
import {
  appendBuildSample,
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  getBuildMonitorKey,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
} from '@hierarchidb/ui-monitoring';
import { shapeEphemeralAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildApiClient.js';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const buildMonitorConfig = {
  storagePrefix: 'hdb:shape:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
} as const;

const fetchTileSummary = async (nodeId: NodeId) => {
  const summary = await shapeQueryAPIImpl.getVectorTileSummary(nodeId);
  return { tiles: summary.tiles, totalBytes: summary.totalBytes };
};

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
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
  const [persistedTasks, setPersistedTasks] = useAtom(persistedTasksAtom);
  const [isStartPending, setIsStartPending] = useState(false);
  const warnedSkippedTasksRef = useRef<Set<string>>(new Set());
  const [stageTaskSummary, setStageTaskSummary] = useState<Record<string, { total: number; success: number; error: number; skip: number }>>({});
  const hasIncompletePersistedTasks = useMemo(() => {
    if (persistedTasks.length === 0) return false;
    return persistedTasks.some((task) => {
      if (isSkippedMessage(task.message)) return false;
      return task.status !== 'completed' && task.status !== 'failed' && task.status !== 'regression';
    });
  }, [persistedTasks]);
  const hasNodeId = Boolean(activeNodeId && !error);
  const effectiveProgress = hasNodeId ? progress : null;
  const effectiveStatus = hasNodeId ? status : null;
  const stages = useBuildStages();
  const { buildStatus, statusLabel } = useBuildStatus(effectiveStatus);
  const gatedBuildStatus = buildStatus === 'completed' && hasIncompletePersistedTasks
    ? 'running'
    : buildStatus;
  const shouldPollTasks = Boolean(activeNodeId)
    && (
      isStartPending
      || data?.processingStatus === 'processing'
      || data?.processingStatus === 'paused'
      || (
        gatedBuildStatus !== 'idle'
        && gatedBuildStatus !== 'failed'
        && (
          gatedBuildStatus !== 'completed'
          || hasIncompletePersistedTasks
          || persistedTasks.length === 0
        )
      )
    );
  const shouldPollTasksRef = useCallback(() => shouldPollTasks, [shouldPollTasks]);
  const { tasks, isLoading: isTasksLoading, refresh: refreshTasks } = useShapeBuildTasks(activeNodeId, {
    autoRefresh: shouldPollTasksRef,
    pollIntervalMs: 2000,
  });
  const [isTaskSummaryLoading, setIsTaskSummaryLoading] = useState(false);
  const displayTasks = tasks.length > 0 ? tasks : persistedTasks;
  const hasTaskSummary = useMemo(() => {
    return Object.values(stageTaskSummary).some((summary) => (
      (summary?.total ?? 0) > 0
      || (summary?.success ?? 0) > 0
      || (summary?.error ?? 0) > 0
      || (summary?.skip ?? 0) > 0
    ));
  }, [stageTaskSummary]);
  const hasIncompleteTasks = useMemo(() => {
    if (displayTasks.length === 0) return false;
    return displayTasks.some((task) => {
      if (isSkippedMessage(task.message)) return false;
      return task.status !== 'completed' && task.status !== 'failed' && task.status !== 'regression';
    });
  }, [displayTasks]);
  const shouldForceRunning = gatedBuildStatus === 'completed' && hasIncompleteTasks;
  const normalizedBuildStatus = shouldForceRunning ? 'running' : gatedBuildStatus;
  const lastBuildStartedAtRef = useRef<number | undefined>(data?.buildStartedAt);
  const selectedArrayByCountries = data?.selectedArrayByCountries;

  const taskType = effectiveProgress?.taskType;
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
  const lastSyncedStatusRef = useRef<string | null>(null);
  const lastStableCountsRef = useRef<{ total: number; completed: number; failed: number; skipped: number; percentage: number } | null>(null);
  const monitorKey = useMemo(() => {
    const resolvedNodeId = nodeId ?? data?.nodeId;
    return getBuildMonitorKey(buildMonitorConfig, resolvedNodeId ? String(resolvedNodeId) : null);
  }, [data?.nodeId, nodeId]);


  useEffect(() => {
    const nextState = {
      nodeId: activeNodeId,
      hasNodeId,
      buildStatus: gatedBuildStatus,
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
    gatedBuildStatus,
    effectiveProgress?.percentage,
    effectiveProgress?.message,
    taskType,
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
  }, [activeNodeId, tasks, setPersistedTasks]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (displayTasks.length > 0) return;
    if (isTasksLoading) return;
    if (!hasTaskSummary && !['failed', 'completed'].includes(normalizedBuildStatus)) return;
    void refreshTasks();
  }, [activeNodeId, displayTasks.length, hasTaskSummary, isTasksLoading, normalizedBuildStatus, refreshTasks]);

  useEffect(() => {
    if (lastBuildStartedAtRef.current !== data?.buildStartedAt) {
      lastBuildStartedAtRef.current = data?.buildStartedAt;
      setStageTaskSummary({});
      setIsTaskSummaryLoading(false);
    }
  }, [data?.buildStartedAt]);

  useEffect(() => {
    if (!activeNodeId) {
      setStageTaskSummary({});
      setIsTaskSummaryLoading(false);
      return;
    }
    if (displayTasks.length > 0 || hasTaskSummary) {
      setIsTaskSummaryLoading(false);
      return;
    }
    let cancelled = false;
    setIsTaskSummaryLoading(true);
    const nodeKey = toNodeId(String(activeNodeId));
    const run = async () => {
      try {
        const rows = await shapeEphemeralAPIImpl.listBuildTasks(nodeKey as NodeId);
        if (cancelled) return;
        const summary: Record<string, { total: number; success: number; error: number; skip: number }> = {};
        const ensure = (key: string) => {
          if (!summary[key]) {
            summary[key] = { total: 0, success: 0, error: 0, skip: 0 };
          }
          return summary[key];
        };
        rows.forEach((task) => {
          const stageKey = task.taskType;
          const slot = ensure(stageKey);
          slot.total += 1;
          if (isSkippedMessage(task.message)) {
            slot.skip += 1;
            return;
          }
          if (task.status === 'failed' || task.status === 'regression') {
            slot.error += 1;
            return;
          }
          if (task.status === 'completed') {
            slot.success += 1;
          }
        });
        setStageTaskSummary(summary);
      } finally {
        if (!cancelled) {
          setIsTaskSummaryLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, displayTasks.length, hasTaskSummary]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (displayTasks.length > 0) return;
    if (!hasTaskSummary) return;
    let cancelled = false;
    const nodeKey = toNodeId(String(activeNodeId));
    const run = async () => {
      try {
        const total = await shapeEphemeralAPIImpl.countBuildTasks(nodeKey as NodeId);
        if (cancelled) return;
        if (total === 0) {
          setStageTaskSummary({});
        }
      } catch (error) {
        if (!cancelled) {
          console.debug('[ShapeBuildStep] taskSummary:resetFailed', error);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, displayTasks.length, hasTaskSummary]);

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
    if (gatedBuildStatus !== 'running') return;
    if (data?.buildStartedAt) return;
    onChange({
      buildStartedAt: Date.now(),
      buildFinishedAt: undefined,
    });
  }, [gatedBuildStatus, data?.buildStartedAt, onChange]);

  useEffect(() => {
    if (!monitorKey) return;
    if (gatedBuildStatus !== 'running') return;
    const startedAt = data?.buildStartedAt ?? Date.now();
    recordBuildStart(buildMonitorConfig, monitorKey, {
      nodeId: data?.nodeId ? String(data.nodeId) : undefined,
      startedAt
    });
    const interval = window.setInterval(() => {
      appendBuildSample(buildMonitorConfig, monitorKey, {
        timestamp: Date.now(),
        stage: taskType as 'fetch' | 'transform' | 'vt' | undefined,
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [gatedBuildStatus, taskType, data?.buildStartedAt, data?.nodeId, monitorKey]);

  useEffect(() => {
    if (!monitorKey) return;
    if (!['completed', 'failed'].includes(gatedBuildStatus)) return;
    if (!data?.buildFinishedAt) {
      onChange({ buildFinishedAt: Date.now() });
    }
    recordBuildFinish(buildMonitorConfig, monitorKey, Date.now());
  }, [gatedBuildStatus, data?.buildFinishedAt, monitorKey, onChange]);

  useEffect(() => {
    if (!activeNodeId) return;
    if (!['running', 'completed'].includes(gatedBuildStatus)) return;
    if ((data?.tileSummary?.tiles ?? 0) > 0) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const summary = await fetchTileSummary(activeNodeId as NodeId);
        if (cancelled) return;
        if (summary.tiles > 0) {
          onChange({ tileSummary: summary });
        }
      } catch (error) {
        console.debug('[ShapeBuildStep] tile summary load failed', error);
      }
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, gatedBuildStatus, data?.tileSummary?.tiles, onChange]);

  useEffect(() => {
    if (!isStartPending) return;
    if (buildStatus !== 'idle') {
      setIsStartPending(false);
    }
  }, [buildStatus, isStartPending]);

  const hasFailedFetchTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && task.stage === 'fetch')
  ), [displayTasks]);

  const taskSummary = useMemo(() => {
    const summary: Record<string, { total: number; completed: number; failed: number; skipped: number }> = {};
    for (const task of displayTasks) {
      const stageKey = task.stage ?? 'unknown';
      if (!summary[stageKey]) {
        summary[stageKey] = { total: 0, completed: 0, failed: 0, skipped: 0 };
      }
      const bucket = summary[stageKey];
      bucket.total += 1;
      if (isSkippedMessage(task.message)) {
        bucket.skipped += 1;
        continue;
      }
      if (task.status === 'failed' || task.status === 'regression') {
        bucket.failed += 1;
        continue;
      }
      if (task.status === 'completed') {
        bucket.completed += 1;
      }
    }
    return summary;
  }, [displayTasks]);
  const aggregatedCounts = useMemo(() => {
    const counts = { total: 0, completed: 0, failed: 0, skipped: 0 };
    displayTasks.forEach((task) => {
      counts.total += 1;
      if (isSkippedMessage(task.message)) {
        counts.skipped += 1;
        return;
      }
      if (task.status === 'failed' || task.status === 'regression') {
        counts.failed += 1;
        return;
      }
      if (task.status === 'completed') {
        counts.completed += 1;
      }
    });
    return counts;
  }, [displayTasks]);
  const summaryCounts = useMemo(() => {
    const counts = { total: 0, completed: 0, failed: 0, skipped: 0 };
    Object.values(stageTaskSummary).forEach((summary) => {
      if (!summary) return;
      counts.total += summary.total ?? 0;
      counts.completed += summary.success ?? 0;
      counts.failed += summary.error ?? 0;
      counts.skipped += summary.skip ?? 0;
    });
    return counts;
  }, [stageTaskSummary]);
  const hasProgressData = Boolean(effectiveProgress)
    || Boolean(effectiveStatus && effectiveStatus.status !== 'idle')
    || displayTasks.length > 0
    || hasTaskSummary;
  useEffect(() => {
    if (displayTasks.length === 0) return;
    const warned = warnedSkippedTasksRef.current;
    for (const task of displayTasks) {
      if (!task.taskId || !isSkippedMessage(task.message)) continue;
      if (warned.has(task.taskId)) continue;
      warned.add(task.taskId);
      console.warn('[ShapeBuildStep] Task skipped', {
        taskId: task.taskId,
        stage: task.stage ?? 'fetch',
        message: task.message,
      });
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
    taskType,
    overallProgress,
    normalizedBuildStatus,
    displayTasks,
  );
  const paneProgressWithSummary = useMemo(() => {
    const failureStageId = normalizedBuildStatus === 'failed'
      ? taskType
      : undefined;
    return stages.map((stage) => {
      const base = paneProgress?.find((entry) => entry.paneId === stage.id);
      const inlineSummary = taskSummary[stage.id];
      const fallbackSummary = stageTaskSummary[stage.id];
      const resolvedSummary = inlineSummary
        ? {
          total: inlineSummary.total,
          success: inlineSummary.completed,
          error: inlineSummary.failed,
          skip: inlineSummary.skipped,
        }
        : fallbackSummary;
      const hasSummaryData = Boolean(
        resolvedSummary
        && ((resolvedSummary.total ?? 0) > 0
          || (resolvedSummary.success ?? 0) > 0
          || (resolvedSummary.error ?? 0) > 0
          || (resolvedSummary.skip ?? 0) > 0),
      );
      let total = hasSummaryData ? (resolvedSummary?.total ?? 0) : (base?.taskCount ?? 0);
      const success = hasSummaryData ? (resolvedSummary?.success ?? 0) : (base?.completedCount ?? 0);
      let error = hasSummaryData ? (resolvedSummary?.error ?? 0) : 0;
      const skip = hasSummaryData ? (resolvedSummary?.skip ?? 0) : 0;
      if (failureStageId && stage.id === failureStageId) {
        error = Math.max(error, 1);
        total = Math.max(total, error + success + skip);
      }
      const done = Math.min(total, success + error + skip);
      const progressValue = total > 0 ? Math.round((done / total) * 100) : (base?.progress ?? 0);
      const status = error > 0
        ? 'failed'
        : total > 0 && success + skip >= total
          ? 'completed'
          : total > 0
            ? 'running'
            : (base?.status ?? normalizedBuildStatus);
      return {
        paneId: stage.id,
        progress: progressValue,
        taskCount: total,
        completedCount: success,
        status,
        summary: { total, success, error, skip },
      };
    });
  }, [taskType, normalizedBuildStatus, paneProgress, stageTaskSummary, stages, taskSummary]);
  const lastUnfinishedStageId = useMemo(() => {
    if (normalizedBuildStatus !== 'running') return undefined;
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
  }, [normalizedBuildStatus, stages, tasksByStage]);
  const displayStageId = lastUnfinishedStageId ?? taskType;
  const displayStageLabel = (() => {
    if (displayStageId) {
      return stages.find((stage) => stage.id === displayStageId)?.title
        ?? displayStageId;
    }
    if (normalizedBuildStatus === 'running') {
      return t('stage.progress.unknownStage', 'processing');
    }
    if (normalizedBuildStatus === 'paused') {
      return t('stage.progress.pausedStage', 'paused');
    }
    if (normalizedBuildStatus === 'completed') {
      return t('stage.progress.completedStage', 'completed');
    }
    return t('stage.progress.idleStage', 'idle');
  })();
  const derivedCounts = useMemo(() => {
    if (!lastUnfinishedStageId) return null;
    const stageTasks = tasksByStage[lastUnfinishedStageId] ?? [];
    if (!stageTasks.length) return null;
    const completedCount = stageTasks.filter((task) => task.status === 'completed' && !isSkippedMessage(task.message)).length;
    const failedCount = stageTasks.filter((task) => task.status === 'failed' || task.status === 'regression').length;
    const skippedCount = stageTasks.filter((task) => isSkippedMessage(task.message)).length;
    return {
      total: Math.max(0, stageTasks.length - skippedCount),
      completed: completedCount,
      failed: failedCount,
      skipped: skippedCount,
    };
  }, [lastUnfinishedStageId, tasksByStage]);
  const rawDisplayCounts = useMemo(() => {
    const applySkippedAdjustment = (next: { total: number; completed: number; failed: number; skipped: number; percentage: number }) => {
      if (next.skipped === 0) return next;
      if (next.completed + next.failed + next.skipped < next.total) return next;
      const effectiveTotal = Math.max(0, next.total - next.skipped);
      const effectiveCompleted = Math.min(next.completed, effectiveTotal);
      const effectiveFailed = Math.min(next.failed, Math.max(0, effectiveTotal - effectiveCompleted));
      const percentage = effectiveTotal > 0
        ? Math.round(((effectiveCompleted + effectiveFailed) / effectiveTotal) * 100)
        : 100;
      return {
        ...next,
        total: effectiveTotal,
        completed: effectiveCompleted,
        failed: effectiveFailed,
        percentage,
      };
    };
    if (total === 0 && completed === 0 && failed === 0 && skipped === 0 && aggregatedCounts.total > 0) {
      return applySkippedAdjustment({
        ...aggregatedCounts,
        percentage: Math.round(((aggregatedCounts.completed + aggregatedCounts.failed) / aggregatedCounts.total) * 100),
      });
    }
    if (total === 0 && completed === 0 && failed === 0 && skipped === 0 && summaryCounts.total > 0) {
      return applySkippedAdjustment({
        ...summaryCounts,
        percentage: Math.round(((summaryCounts.completed + summaryCounts.failed) / summaryCounts.total) * 100),
      });
    }
    if (normalizedBuildStatus === 'running' && total === 0 && completed === 0 && failed === 0 && skipped === 0 && derivedCounts?.total) {
      return applySkippedAdjustment({
        ...derivedCounts,
        percentage: Math.round((derivedCounts.completed / derivedCounts.total) * 100),
      });
    }
    return applySkippedAdjustment({
      total,
      completed,
      failed,
      skipped,
      percentage: Math.round(overallProgress),
    });
  }, [aggregatedCounts, summaryCounts, normalizedBuildStatus, completed, derivedCounts, failed, overallProgress, skipped, total]);
  useEffect(() => {
    if (rawDisplayCounts.total > 0) {
      lastStableCountsRef.current = rawDisplayCounts;
    }
  }, [rawDisplayCounts]);
  const displayCounts = useMemo(() => {
    if (normalizedBuildStatus === 'running' && rawDisplayCounts.total === 0 && hasProgressData) {
      return lastStableCountsRef.current ?? rawDisplayCounts;
    }
    return rawDisplayCounts;
  }, [hasProgressData, normalizedBuildStatus, rawDisplayCounts]);

  const taskLabel = (() => {
    if (normalizedBuildStatus === 'completed') {
      return t('stage.progress.done', 'Completed');
    }
    if (normalizedBuildStatus === 'failed') {
      return t('stage.progress.failed', 'Failed');
    }
    if (normalizedBuildStatus === 'paused') {
      return t('stage.progress.paused', 'Paused');
    }
    if (normalizedBuildStatus !== 'running') {
      if (normalizedBuildStatus === 'idle' && rawDisplayCounts.total > 0) {
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
      ?? (taskType ? stages.find((stage) => stage.id === taskType)?.title ?? taskType : undefined)
      ?? effectiveStatus?.error
      ?? t('stage.progress.working', 'Working...');
  })();

  const isProcessingValid = useMemo(() => (
    validateBatchConfig(
      mergeBatchConfig(data?.batchConfig ?? DEFAULT_PROCESSING_CONFIG),
    ).isValid
  ), [data?.batchConfig]);
  const hasSelection = summarizeCheckboxState(selectedArrayByCountries).hasSelection;
  const hasDataSource = Boolean(data?.batchConfig?.dataSource);
  const canStartOrResume = !isStartPending && normalizedBuildStatus !== 'running'
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
    const ok = await handleStartOrResume({ forceRestart: hasFailedFetchTasks });
    if (!ok) {
      setIsStartPending(false);
    }
  }, [handleStartOrResume, hasFailedFetchTasks, isStartPending]);
  const taskDrivenStatus = useMemo(() => {
    if (normalizedBuildStatus !== 'idle') return normalizedBuildStatus;
    const totalTasks = rawDisplayCounts.total;
    if (totalTasks <= 0) return normalizedBuildStatus;
    const doneCount = rawDisplayCounts.completed + rawDisplayCounts.failed + rawDisplayCounts.skipped;
    return doneCount >= totalTasks ? 'completed' : 'running';
  }, [normalizedBuildStatus, rawDisplayCounts]);
  const effectiveBuildStatus = isStartPending ? 'running' : taskDrivenStatus;
  const effectiveStatusLabel = isStartPending && taskDrivenStatus === 'idle'
    ? t('stage.status.starting', 'Starting stage...')
    : (shouldForceRunning
      ? t('stage.status.running', 'Build in progress')
      : taskDrivenStatus !== normalizedBuildStatus
        ? taskDrivenStatus === 'completed'
          ? t('stage.status.completed', 'Build completed')
          : t('stage.status.running', 'Build in progress')
        : statusLabel);

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
