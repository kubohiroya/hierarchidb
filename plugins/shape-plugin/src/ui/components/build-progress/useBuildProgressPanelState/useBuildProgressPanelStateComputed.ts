import {
  ensureIso3166CountryNamesI18n,
  getLocalizedCountryName,
} from '@hierarchidb/gen-iso3166-2/browser';
import type { BuildStage } from '@hierarchidb/ui-build-progress/build-stage';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '~/common/types/index';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { resolveShapeTaskTitle } from '~/common/utils/taskTitleUtils';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { buildStageTaskScan, type FailureInfo, type StageTaskScan } from './buildStageTaskScan.ts';
import {
  resolveCompletedStatusText,
  resolveFailureMessage,
  type TranslateFn,
} from './useBuildProgressPanelStateComputedHelpers.ts';

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
  locale: string;
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

const resolveStatusLabel =
  (t: TranslateFn) =>
  (statusValue?: string, skipped?: boolean): string => {
    if (skipped) return t('build.taskStatus.skipped', 'Skipped');
    switch (statusValue) {
      case 'running':
        return t('build.taskStatus.running', 'Running');
      case 'completed':
        return t('build.taskStatus.completed', 'Completed');
      case 'recycled':
        return t('build.taskStatus.recycled', 'Recycled');
      case 'failed':
        return t('build.taskStatus.failed', 'Failed');
      case 'paused':
        return t('build.taskStatus.paused', 'Paused');
      case 'queued':
        return t('build.taskStatus.queued', 'Queued');
      default:
        return t('build.taskStatus.waiting', 'Waiting');
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
  if (totalSeconds === 0) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || (hours > 0 && seconds > 0)) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(' ');
};

const buildFailedTaskInfo = (
  stages: BuildStage[],
  stageTaskScan: StageTaskScan,
  resolveTaskTitle: (task: TaskItemWithMetadata) => string
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

export const useBuildProgressPanelStateComputed = (
  args: ComputeArgs
): BuildProgressPanelStateComputed => {
  const { data, summary, t, locale, stages, stageProgress, tasksByStage } = args;
  const [countryNamesReadyEpoch, setCountryNamesReadyEpoch] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      await ensureIso3166CountryNamesI18n();
      if (!active) return;
      setCountryNamesReadyEpoch((prev) => prev + 1);
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const stageTaskScan = useMemo(
    () => buildStageTaskScan(stages, tasksByStage as Record<string, ShapeBuildTaskSummary[]>),
    [stages, tasksByStage]
  );

  const activeStageId = useMemo(() => {
    if (summary.buildStatus !== 'running') return null;
    const runningStageIds = stages
      .filter((stage) => stageTaskScan[stage.id]?.hasRunning)
      .map((stage) => stage.id);
    return runningStageIds[0] ?? null;
  }, [summary.buildStatus, stages, stageTaskScan]);

  const resolveTaskTitle = useCallback(
    (task: TaskItemWithMetadata) =>
      resolveShapeTaskTitle(task, t('stage.tasks.unknown', '(Title unavailable)'), {
        resolveCountryNameByCode: (code) => getLocalizedCountryName(code, locale) ?? undefined,
      }),
    [countryNamesReadyEpoch, locale, t]
  );

  const failedTaskInfo = useMemo(
    () => buildFailedTaskInfo(stages, stageTaskScan, resolveTaskTitle),
    [resolveTaskTitle, stages, stageTaskScan]
  );

  const completionStageLabel = summary.stageLabel?.trim()
    ? summary.stageLabel
    : t('stage.progress.unknownStage', 'Unknown stage');
  const finalStage = stages[stages.length - 1];
  const finalStageLabel = finalStage?.title ?? finalStage?.id ?? completionStageLabel;
  const isFinalStageLabel = finalStage
    ? completionStageLabel === finalStage.title || completionStageLabel === finalStage.id
    : true;
  const completionTaskTitle =
    failedTaskInfo.title ?? t('stage.tasks.unknown', '(Task unavailable)');
  const completionTaskMessage =
    failedTaskInfo.message ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  const completionFailedStageLabel = (() => {
    if (!failedTaskInfo.stageId) return completionStageLabel;
    const failedStage = stages.find((stage) => stage.id === failedTaskInfo.stageId);
    return failedStage?.title ?? failedTaskInfo.stageId;
  })();

  const completionReason = resolveCompletedStatusText(summary.buildStatus, summary.taskLabel, t);
  const emptyValue = t('stage.timing.unknown', '-');
  const isBuildStarted = summary.buildStatus !== 'idle' || summary.totalElapsedMs > 0;

  const controlDetails = useMemo(
    () => [
      {
        label: t('stage.timing.totalElapsed', 'Total elapsed:'),
        value: isBuildStarted ? formatDuration(summary.totalElapsedMs, t) : emptyValue,
        icon: 'timelapse' as const,
      },
    ],
    [emptyValue, isBuildStarted, summary.buildStatus, summary.totalElapsedMs, t]
  );

  const resolveStageValue = useCallback(
    (stageId: string): number =>
      Math.min(100, Math.max(0, stageProgress[stageId] ?? summary.overallProgress)),
    [summary.overallProgress, stageProgress]
  );

  const stageConcurrencyIndicators = useMemo(() => {
    const processingConfig = data?.processingConfig
      ? mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG, data.processingConfig)
      : DEFAULT_PROCESSING_CONFIG;
    const isBuildRunning = summary.buildStatus === 'running';

    return stages.reduce<Record<string, { maxConcurrent: number; isRunning: boolean }>>(
      (acc, stage) => {
        const isStageRunning = isBuildRunning && Boolean(stageTaskScan[stage.id]?.hasRunning);
        const maxConcurrent =
          stage.id === 'source'
            ? processingConfig.source.maxConcurrent
            : stage.id === 'geometry'
              ? processingConfig.geometry.maxConcurrent
              : stage.id === 'tileEmit'
                ? processingConfig.tileEmit.maxConcurrent
                : undefined;
        if (maxConcurrent === undefined) return acc;
        acc[stage.id] = { maxConcurrent, isRunning: isStageRunning };
        return acc;
      },
      {}
    );
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
