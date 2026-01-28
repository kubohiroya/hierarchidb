import { useEffect, useMemo, useRef } from 'react';
import type { NodeId, NodeType, TaskStage } from '@hierarchidb/common-types';
import { useShapeBuildTasks } from './useShapeBuildTasks.ts';
import { useBuildProgress } from './useBuildProgress.js';
import { useTranslation } from '../../i18n.js';
import {
  summarizeCheckboxState,
  validateBatchConfig,
  type ShapeEntity,
} from '../../../common/types/index.js';
import { useBuildStages } from './useBuildStages.js';
import { useBuildTaskProgress } from '@hierarchidb/ui-batch-progress';
import type { BuildStatus } from '@hierarchidb/components';
import { useBatchSessionActions } from './useBatchSessionActions.js';
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
  const stages = useBuildStages();
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
    canResume: buildStatus === 'paused',
  });
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
