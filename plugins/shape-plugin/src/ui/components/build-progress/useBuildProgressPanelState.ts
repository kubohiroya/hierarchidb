import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import { flushSync } from 'react-dom';
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
import { isTaskPhaseDisplay, isTaskPhaseMessage } from '../../../common/utils/taskMessages.ts';

const isDev = import.meta.env.DEV;
const START_RESUME_TRACE_PREFIX = '[ShapeBuildStartResumeTrace]';
const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';

const logStartResumeTrace = (event: string, payload?: Record<string, unknown>): void => {
  console.log(`${START_RESUME_TRACE_PREFIX} ${event}`, payload ?? {});
};

const formatRunningResidueValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized.replace(/\s+/g, '_') : '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const logRunningResiduePanel = (
  keyword: 'UI_MISMATCH' | 'UI_MISMATCH_RESOLVED',
  payload: {
    nodeId: string | null;
    stage: string;
    buildStatus: BuildStatus;
    activeStageId: string | null;
    indicatorIsRunning: boolean;
    runningCount: number;
    runningTaskIds: string[];
    reasons: string[];
  },
): void => {
  if (!isDev) return;
  const line = `${RUNNING_RESIDUE_LOG_PREFIX} ${keyword}`
    + ` nodeId=${formatRunningResidueValue(payload.nodeId)}`
    + ` stage=${formatRunningResidueValue(payload.stage)}`
    + ` taskId=${formatRunningResidueValue(payload.runningTaskIds.join(','))}`
    + ` sequence=- prevStatus=- nextStatus=-`
    + ` source=ui`
    + ` eventType=aggregate`
    + ` reason=${formatRunningResidueValue(payload.reasons.join(','))}`
    + ` runningCount=${formatRunningResidueValue(payload.runningCount)}`
    + ` queuedCount=- totalCount=-`
    + ` stageIsRunning=${formatRunningResidueValue(payload.indicatorIsRunning)}`
    + ` buildStatus=${formatRunningResidueValue(payload.buildStatus)}`
    + ` activeStageId=${formatRunningResidueValue(payload.activeStageId)}`
    + ` timestamp=${Date.now()}`;
  console.log(line, payload);
};

export const shouldUpdateElapsedSnapshot = (params: {
  snapshot: { elapsedMs: number; capturedAt: number } | null;
  totalElapsedMs: number;
  buildStatus: BuildStatus;
}): boolean => {
  const { snapshot, totalElapsedMs, buildStatus } = params;
  if (!snapshot) return true;
  if (buildStatus !== 'running') return true;
  // Reset Session may zero elapsed before build status settles to idle/paused.
  if (totalElapsedMs === 0) return true;
  return totalElapsedMs > snapshot.elapsedMs;
};

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
  const [localStartPending, setLocalStartPending] = useState(false);
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
  const mismatchSignatureRef = useRef<Map<string, string>>(new Map());
  const crashInsight = useBuildCrashInsight({
    draft: params.data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
    status: summary.buildStatus,
  });
  const stageTaskScan = useMemo(() => {
    return stages.reduce<Record<string, {
      hasRunning: boolean;
      failedTask: ShapeBuildTaskSummary | null;
      runningCount: number;
      queuedCount: number;
      totalCount: number;
    }>>((acc, stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      let hasRunning = false;
      let failedTask: ShapeBuildTaskSummary | null = null;
      let runningCount = 0;
      let queuedCount = 0;
      for (const task of stageTasks) {
        if (task.status === 'running') {
          runningCount += 1;
        }
        if (task.status === 'queued') {
          queuedCount += 1;
        }
        if (!hasRunning && task.status === 'running') {
          hasRunning = true;
        }
        if (!failedTask && (task.status === 'failed' || task.status === 'regression')) {
          failedTask = task;
        }
      }
      acc[stage.id] = {
        hasRunning,
        failedTask,
        runningCount,
        queuedCount,
        totalCount: stageTasks.length,
      };
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
      || isTaskPhaseMessage(message)
      || isTaskPhaseDisplay(task.display);
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
    if (shouldUpdateElapsedSnapshot({
      snapshot,
      totalElapsedMs: summary.totalElapsedMs,
      buildStatus: summary.buildStatus,
    })) {
      totalElapsedSnapshotRef.current = {
        elapsedMs: summary.totalElapsedMs,
        capturedAt: elapsedTickMs,
      };
    }
  }, [summary.totalElapsedMs, summary.buildStatus, elapsedTickMs]);

  const liveTotalElapsedMs = useMemo(() => {
    const snapshot = totalElapsedSnapshotRef.current;
    if (summary.buildStatus === 'running' && summary.totalElapsedMs === 0) {
      return 0;
    }
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
      // Keep slot animation tied to actual task runtime, even if session status lags behind.
      const isStageRunning = Boolean(stageTaskScan[stage.id]?.hasRunning);
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
  }, [params.data?.buildConfig, stageTaskScan, stages]);
  useEffect(() => {
    if (!isDev) return;
    const nodeIdForLog = resolvedNodeId ? String(resolvedNodeId) : null;
    const nextSignatures = new Map<string, string>();
    const previousSignatures = mismatchSignatureRef.current;
    stages.forEach((stage) => {
      const scan = stageTaskScan[stage.id];
      const indicator = stageConcurrencyIndicators?.[stage.id];
      const runningCount = scan?.runningCount ?? 0;
      const indicatorIsRunning = Boolean(indicator?.isRunning);
      const reasons: string[] = [];
      if (summary.buildStatus === 'running' && indicatorIsRunning !== (runningCount > 0)) {
        reasons.push('indicator_running_mismatch');
      }
      if (summary.buildStatus !== 'running' && runningCount > 0) {
        reasons.push('running_while_build_not_running');
      }
      if (summary.buildStatus === 'running' && runningCount > 0 && activeStageId !== stage.id) {
        reasons.push('running_stage_not_active');
      }
      if (summary.buildStatus === 'running' && activeStageId === stage.id && runningCount === 0) {
        reasons.push('active_stage_without_running_task');
      }
      if (reasons.length === 0) {
        if (previousSignatures.has(stage.id)) {
          logRunningResiduePanel('UI_MISMATCH_RESOLVED', {
            nodeId: nodeIdForLog,
            stage: stage.id,
            buildStatus: summary.buildStatus,
            activeStageId,
            indicatorIsRunning,
            runningCount,
            runningTaskIds: [],
            reasons: ['resolved'],
          });
        }
        return;
      }
      const runningTaskIds = (tasksByStage[stage.id] ?? [])
        .filter((task) => task.status === 'running')
        .slice(0, 8)
        .map((task) => task.taskId);
      const signature = [
        summary.buildStatus,
        activeStageId ?? '-',
        runningCount,
        indicatorIsRunning ? '1' : '0',
        reasons.join('|'),
        runningTaskIds.join('|'),
      ].join('::');
      nextSignatures.set(stage.id, signature);
      if (previousSignatures.get(stage.id) === signature) {
        return;
      }
      logRunningResiduePanel('UI_MISMATCH', {
        nodeId: nodeIdForLog,
        stage: stage.id,
        buildStatus: summary.buildStatus,
        activeStageId,
        indicatorIsRunning,
        runningCount,
        runningTaskIds,
        reasons,
      });
    });
    mismatchSignatureRef.current = nextSignatures;
  }, [
    activeStageId,
    resolvedNodeId,
    stageConcurrencyIndicators,
    stageTaskScan,
    stages,
    summary.buildStatus,
    tasksByStage,
  ]);

  useEffect(() => {
    return () => {
      mismatchSignatureRef.current = new Map();
    };
  }, []);

  const setLocalStartPendingImmediate = useCallback((next: boolean) => {
    flushSync(() => {
      setLocalStartPending(next);
    });
  }, []);

  const runStartOrResume = useCallback(async () => {
    const requestStartedAt = Date.now();
    const startHandler = controls.handleStartOrResume;
    logStartResumeTrace('runStartOrResume invoked', {
      nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
      localStartPending,
      controlStartPending: Boolean(controls.startPending),
      hasStartHandler: Boolean(startHandler),
      buildStatus: summary.buildStatus,
    });
    if (localStartPending) {
      logStartResumeTrace('runStartOrResume skipped (already pending)', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
      });
      return;
    }
    if (!startHandler) {
      logStartResumeTrace('runStartOrResume skipped (missing handler)', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
      });
      return;
    }
    setLocalStartPendingImmediate(true);
    logStartResumeTrace('runStartOrResume pending enabled', {
      nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
    });
    let waitTick = 0;
    const waitTimer: ReturnType<typeof setInterval> = setInterval(() => {
      waitTick += 1;
      logStartResumeTrace('runStartOrResume waiting for handler', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
        waitTick,
      });
    }, 3000);
    try {
      await startHandler();
      logStartResumeTrace('runStartOrResume handler resolved', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
      });
    } catch (error) {
      logStartResumeTrace('runStartOrResume handler rejected', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearInterval(waitTimer);
      setLocalStartPending(false);
      logStartResumeTrace('runStartOrResume pending cleared', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
        elapsedMs: Math.max(0, Date.now() - requestStartedAt),
      });
    }
  }, [
    controls.handleStartOrResume,
    controls.startPending,
    localStartPending,
    resolvedNodeId,
    setLocalStartPendingImmediate,
    summary.buildStatus,
  ]);

  const mergedControls = useMemo(() => ({
    ...controls,
    startPending: Boolean(controls.startPending) || localStartPending,
  }), [controls, localStartPending]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      logStartResumeTrace('handleStartClick blocked by warning dialog', {
        nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
        warningMessage,
      });
      setWarningDialogOpen(true);
      return;
    }
    logStartResumeTrace('handleStartClick proceed', {
      nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
      buildStatus: summary.buildStatus,
    });
    await runStartOrResume();
  }, [
    resolvedNodeId,
    runStartOrResume,
    setWarningDialogOpen,
    startWarning,
    summary.buildStatus,
    warningMessage,
  ]);

  const handleConfirmStart = useCallback(async () => {
    logStartResumeTrace('handleConfirmStart proceed', {
      nodeId: resolvedNodeId ? String(resolvedNodeId) : null,
      buildStatus: summary.buildStatus,
    });
    setWarningDialogOpen(false);
    await runStartOrResume();
  }, [resolvedNodeId, runStartOrResume, setWarningDialogOpen, summary.buildStatus]);

  return {
    t,
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    tasksByStage,
    summary,
    controls: mergedControls,
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
