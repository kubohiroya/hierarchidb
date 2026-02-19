import { useCallback, useMemo } from 'react';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../common/types/index.js';
import { resolveShapeTaskTitle } from '../../../common/utils/taskTitles.ts';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import type { TaskItemWithMetadata } from './TaskItemCardListCard/TaskItemCardListCard.tsx';
import {
  buildStageTaskScan,
  type FailureInfo,
  type StageTaskScan,
} from './useBuildProgressPanelStateComputedTaskScan.js';
import {
  resolveCompletedStatusText,
  resolveFailureMessage,
  type TranslateFn,
} from './useBuildProgressPanelStateComputedHelpers.js';

type StageTaskStatusColor = 'default' | 'success' | 'error' | 'warning' | 'info';

type ComputeArgs = {
  data?: Partial<ShapeEntity>;
  summary: {
    buildStatus: BuildStatus;
    stageLabel?: string;
    taskLabel?: string;
    overallProgress: number;
    totalElapsedMs: number;
  };
  t: TranslateFn;
  stages: BuildStage[];
  stageProgress: Record<string, number>;
  tasksByStage: Record<string, unknown[]>;
};

export type CompletionSnapshotData = {
  completionStageLabel: string;
  completionFailedStageLabel: string;
  completionReason: string;
  completionTaskTitle: string;
  completionTaskMessage: string;
  finalStageLabel: string;
  isFinalStageLabel: boolean;
};

export type BuildProgressPanelStateComputed = {
  t: TranslateFn;
  stages: BuildStage[];
  stageTaskScan: StageTaskScan;
  activeStageId: string | null;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => StageTaskStatusColor;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  controlDetails: Array<{ label: string; value: string; icon: 'timelapse' }>;
  resolveStageValue: (stageId: string) => number;
  stageConcurrencyIndicators: Record<string, { maxConcurrent: number; isRunning: boolean }>;
  completionSnapshotData: CompletionSnapshotData;
};

const resolveStatusLabel = (t: TranslateFn) => (statusValue?: string, skipped?: boolean): string => {
  if (skipped) return t('stage.taskStatus.skipped', 'Skipped');
  switch (statusValue) {
    case 'running':
      return t('stage.taskStatus.running', 'Running');
    case 'completed':
      return t('stage.taskStatus.completed', 'Completed');
    case 'recycled':
      return t('stage.taskStatus.recycled', 'Recycled');
    case 'failed':
      return t('stage.taskStatus.failed', 'Failed');
    case 'paused':
      return t('stage.taskStatus.paused', 'Paused');
    case 'queued':
      return t('stage.taskStatus.queued', 'Queued');
    default:
      return t('stage.taskStatus.waiting', 'Waiting');
  }
};

const resolveStatusColor = (statusValue?: string, skipped?: boolean): StageTaskStatusColor => {
  if (skipped) return 'warning';
  switch (statusValue) {
    case 'completed':
    case 'recycled':
      return 'success';
    case 'failed':
      return 'error';
    case 'paused':
      return 'warning';
    case 'running':
      return 'info';
    default:
      return 'default';
  }
};

const formatDuration = (durationMs: number | null | undefined, t: TranslateFn): string => {
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
};

const buildFailedTaskInfo = (
  stages: BuildStage[],
  stageTaskScan: StageTaskScan,
  resolveTaskTitle: (task: TaskItemWithMetadata) => string,
): FailureInfo => {
  for (const stage of stages) {
    const failedTask = stageTaskScan[stage.id]?.failedTask ?? null;
    if (!failedTask) continue;
    const failureMessage = resolveFailureMessage(failedTask);
    if (!failureMessage) continue;
    return {
      stageId: stage.id,
      title: resolveTaskTitle(failedTask),
      message: failureMessage,
    };
  }
  return {};
};

export const useBuildProgressPanelStateComputed = (args: ComputeArgs): BuildProgressPanelStateComputed => {
  const {
    data,
    summary,
    t,
    stages,
    stageProgress,
    tasksByStage,
  } = args;

  const stageTaskScan = useMemo(
    () => buildStageTaskScan(stages, tasksByStage as Record<string, ShapeBuildTaskSummary[]>),
    [stages, tasksByStage],
  );

  const activeStageId = useMemo(() => {
    if (summary.buildStatus !== 'running') return null;
    const runningStageIds = stages
      .filter((stage) => stageTaskScan[stage.id]?.hasRunning)
      .map((stage) => stage.id);
    return runningStageIds[0] ?? null;
  }, [summary.buildStatus, stages, stageTaskScan]);

  const resolveTaskTitle = useCallback((task: TaskItemWithMetadata) => (
    resolveShapeTaskTitle(task, t('stage.tasks.unknown', '(Title unavailable)'))
  ), [t]);

  const failedTaskInfo = useMemo(
    () => buildFailedTaskInfo(stages, stageTaskScan, resolveTaskTitle),
    [resolveTaskTitle, stages, stageTaskScan],
  );

  const completionStageLabel = summary.stageLabel?.trim()
    ? summary.stageLabel
    : t('stage.progress.unknownStage', 'Unknown stage');
  const finalStage = stages[stages.length - 1];
  const finalStageLabel = finalStage?.title ?? finalStage?.id ?? completionStageLabel;
  const isFinalStageLabel = finalStage
    ? completionStageLabel === finalStage.title || completionStageLabel === finalStage.id
    : true;
  const completionTaskTitle = failedTaskInfo.title
    ?? t('stage.tasks.unknown', '(Task unavailable)');
  const completionTaskMessage = failedTaskInfo.message
    ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  const completionFailedStageLabel = (() => {
    if (!failedTaskInfo.stageId) return completionStageLabel;
    const failedStage = stages.find((stage) => stage.id === failedTaskInfo.stageId);
    return failedStage?.title ?? failedTaskInfo.stageId;
  })();

  const completionReason = resolveCompletedStatusText(summary.buildStatus, summary.taskLabel, t);
  const emptyValue = t('stage.timing.unknown', '-');
  const isBuildStarted = summary.buildStatus !== 'idle' || summary.totalElapsedMs > 0;

  const controlDetails = useMemo(() => ([{
    label: t('stage.timing.totalElapsed', 'Total elapsed'),
    value: isBuildStarted
      ? formatDuration(summary.totalElapsedMs, t)
      : emptyValue,
    icon: 'timelapse' as const,
  }]), [emptyValue, isBuildStarted, summary.buildStatus, summary.totalElapsedMs, t]);

  const resolveStageValue = useCallback((stageId: string): number => (
    Math.min(100, Math.max(0, stageProgress[stageId] ?? summary.overallProgress))
  ), [summary.overallProgress, stageProgress]);

  const stageConcurrencyIndicators = useMemo(() => {
    const processingConfig = data?.processingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data.processingConfig)
      : DEFAULT_PROCESSING_CONFIG;
    const isBuildRunning = summary.buildStatus === 'running';

    return stages.reduce<Record<string, { maxConcurrent: number; isRunning: boolean }>>((acc, stage) => {
      const isStageRunning = isBuildRunning && Boolean(stageTaskScan[stage.id]?.hasRunning);
      const maxConcurrent = stage.id === 'fetch'
        ? processingConfig.fetch.maxConcurrent
        : stage.id === 'transform'
          ? processingConfig.transform.maxConcurrent
          : stage.id === 'vt'
            ? processingConfig.vt.maxConcurrent
            : undefined;
      if (maxConcurrent === undefined) return acc;
      acc[stage.id] = { maxConcurrent, isRunning: isStageRunning };
      return acc;
    }, {});
  }, [data?.processingConfig, stageTaskScan, stages, summary.buildStatus]);

  return {
    t,
    stages,
    stageTaskScan,
    activeStageId,
    resolveStatusLabel: resolveStatusLabel(t),
    resolveStatusColor,
    resolveTaskTitle,
    controlDetails,
    resolveStageValue,
    stageConcurrencyIndicators,
    completionSnapshotData: {
      completionStageLabel,
      completionFailedStageLabel,
      completionReason,
      completionTaskTitle,
      completionTaskMessage,
      finalStageLabel,
      isFinalStageLabel,
    },
  };
};
