import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import type { BuildStatus } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { resolveShapeTaskTitle } from '../../../common/utils/taskTitles.ts';
import { useBuildCrashInsight } from './useBuildCrashInsight.js';
import { useShapeBuildProgressWarnings } from './useShapeBuildProgressWarnings.js';
import {
  taskPaneProgressAtom,
  taskProgressControlsAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  tasksLoadingAtom,
  taskWarningMessageAtom,
  buildStageProgressAtom,
  buildStagesAtom,
  tasksByStageAtom,
  crashSuspectMessageAtom,
  crashSuspectOpenAtom,
  crashSuspectControlsAtom,
  suspendSuspectMessageAtom,
  suspendSuspectOpenAtom,
  suspendSuspectControlsAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import type { ShapeBuildConfig } from '../../../common/types/build.js';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.ts';

const isDev = import.meta.env.DEV;

export const useBuildProgressPanelState = (params: {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
}) => {
  const resolvedNodeId = params.nodeId as NodeId | undefined;
  const { t } = useTranslation();
  const stages = useAtomValue(buildStagesAtom);
  const stageProgress = useAtomValue(buildStageProgressAtom);
  const paneProgress = useAtomValue(taskPaneProgressAtom);
  const isTasksLoading = useAtomValue(tasksLoadingAtom);
  const isTaskSummaryLoading = useAtomValue(taskSummaryLoadingAtom);
  const tasksByStage = useAtomValue(tasksByStageAtom);
  const summary = useAtomValue(taskProgressSummaryAtom);
  const controls = useAtomValue(taskProgressControlsAtom);
  const warningMessage = useAtomValue(taskWarningMessageAtom);
  const crashSuspectMessage = useAtomValue(crashSuspectMessageAtom);
  const crashSuspectOpen = useAtomValue(crashSuspectOpenAtom);
  const crashSuspectControls = useAtomValue(crashSuspectControlsAtom);
  const suspendSuspectMessage = useAtomValue(suspendSuspectMessageAtom);
  const suspendSuspectOpen = useAtomValue(suspendSuspectOpenAtom);
  const suspendSuspectControls = useAtomValue(suspendSuspectControlsAtom);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [elapsedTickMs, setElapsedTickMs] = useState(() => Date.now());
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const completionKeyRef = useRef<string | null>(null);
  const totalElapsedSnapshotRef = useRef<{ elapsedMs: number; capturedAt: number } | null>(null);
  const crashInsight = useBuildCrashInsight({
    draft: params.data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
  });
  const stageTaskScan = useMemo(() => {
    return stages.reduce<Record<string, { hasRunning: boolean; failedTask: ShapeBuildTaskSummary | null }>>((acc, stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      let hasRunning = false;
      let failedTask: ShapeBuildTaskSummary | null = null;
      for (const task of stageTasks) {
        if (!hasRunning && task.status === 'running') {
          hasRunning = true;
        }
        if (!failedTask && (task.status === 'failed' || task.status === 'regression')) {
          failedTask = task;
        }
        if (hasRunning && failedTask) {
          break;
        }
      }
      acc[stage.id] = { hasRunning, failedTask };
      return acc;
    }, {});
  }, [stages, tasksByStage]);
  const activeStageId = useMemo(() => {
    if (summary.buildStatus !== 'running') return null;
    for (const stage of stages) {
      if (stageTaskScan[stage.id]?.hasRunning) {
        return stage.id;
      }
    }
    return null;
  }, [stageTaskScan, stages, summary.buildStatus]);
  const {
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
  } = useShapeBuildProgressWarnings({
    crashInsight,
    data: params.data,
    stages,
    warningMessage,
    isDev,
    t,
  });

  const resolveTaskTitle = useCallback(
    (task: TaskWithMetadata): string =>
      resolveShapeTaskTitle(task, t('stage.tasks.unknown', '(Title unavailable)')),
    [t],
  );
  const resolveFailureMessage = useCallback((task: ShapeBuildTaskSummary): string | null => {
    const message = typeof task.message === 'string' ? task.message.trim() : '';
    const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
    const error = typeof task.error === 'string' ? task.error.trim() : '';
    const fallback = errorMessage || error;
    const normalized = message.toLowerCase();
    const isGeneric = !message
      || normalized === 'failed'
      || normalized === 'stage task failed'
      || normalized.startsWith('phase=');
    if (fallback && isGeneric) return fallback;
    if (message) return message;
    return fallback || null;
  }, []);
  const failedTaskInfo = useMemo(() => {
    for (const stage of stages) {
      const failedTask = stageTaskScan[stage.id]?.failedTask ?? null;
      if (!failedTask) continue;
      const failureMessage = resolveFailureMessage(failedTask);
      if (!failureMessage) continue;
      return {
        title: resolveTaskTitle(failedTask as TaskWithMetadata),
        message: failureMessage,
      };
    }
    return null;
  }, [resolveFailureMessage, resolveTaskTitle, stageTaskScan, stages]);

  const completionStageLabel = summary.stageLabel?.trim()
    ? summary.stageLabel
    : t('stage.progress.unknownStage', 'Unknown stage');
  const finalStage = stages[stages.length - 1];
  const finalStageLabel = finalStage?.title ?? finalStage?.id ?? completionStageLabel;
  const isFinalStageLabel = finalStage
    ? completionStageLabel === finalStage.title || completionStageLabel === finalStage.id
    : true;
  const completionTaskTitle = failedTaskInfo?.title
    ?? t('stage.tasks.unknown', '(Task unavailable)');
  const completionTaskMessage = failedTaskInfo?.message
    ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  const completionReason = (() => {
    if (summary.buildStatus === 'failed') {
      const candidate = summary.taskLabel?.trim();
      if (candidate && candidate.toLowerCase() !== 'failed') return candidate;
      return t('stage.progress.failedReason', 'Build failed due to task errors.');
    }
    if (summary.buildStatus === 'completed') {
      return t('stage.progress.completedReason', 'All tasks completed.');
    }
    return t('stage.progress.endedReason', 'Build ended.');
  })();

  useEffect(() => {
    if (summary.buildStatus === 'completed') {
      if (!isFinalStageLabel) return;
      const key = `${summary.buildStatus}:${completionStageLabel}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: finalStageLabel,
        reason: completionReason,
      });
      setCompletionDialogOpen(true);
      return;
    }
    if (summary.buildStatus === 'failed') {
      if (!failedTaskInfo?.message) {
        return;
      }
      const key = `${summary.buildStatus}:${completionStageLabel}:${completionTaskTitle ?? ''}:${completionTaskMessage ?? ''}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionStageLabel,
        taskTitle: completionTaskTitle,
        taskMessage: completionTaskMessage,
      });
      setCompletionDialogOpen(true);
      return;
    }
    completionKeyRef.current = null;
  }, [
    completionReason,
    completionStageLabel,
    completionTaskMessage,
    completionTaskTitle,
    failedTaskInfo?.message,
    isFinalStageLabel,
    summary.buildStatus,
  ]);

  const resolveStatusLabel = useCallback((statusValue?: string, skipped?: boolean): string => {
    if (skipped) {
      return t('stage.taskStatus.skipped', 'Skipped');
    }
    switch (statusValue) {
      case 'running':
        return t('stage.taskStatus.running', 'Running');
      case 'completed':
        return t('stage.taskStatus.completed', 'Completed');
      case 'failed':
        return t('stage.taskStatus.failed', 'Failed');
      case 'regression':
        return t('stage.taskStatus.regression', 'Regression');
      case 'paused':
        return t('stage.taskStatus.paused', 'Paused');
      case 'queued':
        return t('stage.taskStatus.queued', 'Queued');
      default:
        return t('stage.taskStatus.waiting', 'Waiting');
    }
  }, [t]);

  const resolveStatusColor = useCallback((statusValue?: string, skipped?: boolean) => {
    if (skipped) {
      return 'warning';
    }
    switch (statusValue) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'regression':
        return 'warning';
      case 'paused':
        return 'warning';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  }, []);

  const formatDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || durationMs < 0 || !Number.isFinite(durationMs)) {
      return t('stage.timing.unknown', '-');
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t('stage.timing.duration', '{{hours}}h {{minutes}}m {{seconds}}s', {
      hours,
      minutes,
      seconds,
    });
  }, [t]);

  const formatElapsedDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || durationMs <= 0 || !Number.isFinite(durationMs)) {
      return t('stage.timing.unknown', '-');
    }
    return formatDuration(durationMs);
  }, [formatDuration, t]);

  useEffect(() => {
    setElapsedTickMs(Date.now());
    if (summary.buildStatus !== 'running') {
      return;
    }
    const timerId = window.setInterval(() => {
      setElapsedTickMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [summary.buildStatus]);

  useEffect(() => {
    const snapshot = totalElapsedSnapshotRef.current;
    if (!snapshot || summary.totalElapsedMs > snapshot.elapsedMs || summary.buildStatus !== 'running') {
      totalElapsedSnapshotRef.current = {
        elapsedMs: summary.totalElapsedMs,
        capturedAt: elapsedTickMs,
      };
    }
  }, [summary.totalElapsedMs, summary.buildStatus, elapsedTickMs]);

  const liveTotalElapsedMs = useMemo(() => {
    const snapshot = totalElapsedSnapshotRef.current;
    if (!snapshot || summary.buildStatus !== 'running') {
      return summary.totalElapsedMs;
    }
    const drift = Math.max(0, elapsedTickMs - snapshot.capturedAt);
    return snapshot.elapsedMs + drift;
  }, [elapsedTickMs, summary.buildStatus, summary.totalElapsedMs]);

  const controlDetails = useMemo(() => {
    const isBuildStarted = summary.buildStatus !== 'idle' || summary.totalElapsedMs > 0;
    const emptyValue = t('stage.timing.unknown', '-');
    return [
      {
        label: t('stage.timing.totalElapsed', 'Total elapsed'),
        value: isBuildStarted ? formatElapsedDuration(liveTotalElapsedMs) : emptyValue,
        icon: 'timelapse' as const,
      },
    ];
  }, [
    formatElapsedDuration,
    liveTotalElapsedMs,
    summary.buildStatus,
    summary.totalElapsedMs,
    t,
  ]);

  const resolveStageValue = useCallback((stageId: string): number => (
    Math.min(100, Math.max(0, stageProgress[stageId] ?? summary.overallProgress))
  ), [stageProgress, summary.overallProgress]);

  const stageConcurrencyIndicators = useMemo(() => {
    const buildConfig = params.data?.buildConfig
      ?? (params.data as { batchConfig?: ShapeBuildConfig } | undefined)?.batchConfig;
    if (!buildConfig) return undefined;
    return stages.reduce<Record<string, { maxConcurrent: number; isRunning: boolean }>>((acc, stage) => {
      const isStageRunning = summary.buildStatus === 'running'
        && Boolean(stageTaskScan[stage.id]?.hasRunning);
      const maxConcurrent = (() => {
        switch (stage.id) {
          case 'fetch':
            return buildConfig.fetchConfig.maxConcurrent;
          case 'transform':
            return buildConfig.transformConfig.maxConcurrent;
          case 'vt':
            return buildConfig.vtConfig.maxConcurrent;
          default:
            return undefined;
        }
      })();
      if (maxConcurrent === undefined) return acc;
      acc[stage.id] = { maxConcurrent, isRunning: isStageRunning };
      return acc;
    }, {});
  }, [params.data?.buildConfig, stageTaskScan, stages, summary.buildStatus]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      setWarningDialogOpen(true);
      return;
    }
    await controls.handleStartOrResume?.();
  }, [controls, setWarningDialogOpen, startWarning]);

  const handleConfirmStart = useCallback(async () => {
    setWarningDialogOpen(false);
    await controls.handleStartOrResume?.();
  }, [controls, setWarningDialogOpen]);

  return {
    t,
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    tasksByStage,
    summary,
    controls,
    warningMessage,
    activeStageId,
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    finalStageLabel,
    resolveTaskTitle,
    resolveStatusLabel,
    resolveStatusColor,
    controlDetails,
    resolveStageValue,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
  };
};
