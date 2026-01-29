import { useMemo } from 'react';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { BuildProgress, BuildProgressStatus } from './shapeBuildProgressMapping.ts';
import type { TaskCountSummary } from '@hierarchidb/ui-batch-progress';

type Translate = (key: string, fallback?: string) => string;

type CountsWithPercentage = TaskCountSummary & { percentage: number };

type Args = {
  t: Translate;
  buildStatus: BuildStatus;
  effectiveStatus: BuildProgressStatus | null;
  effectiveProgress: BuildProgress | null;
  stages: BuildStage[];
  resolvedTaskType?: string;
  displayStageId?: string;
  rawDisplayCounts: CountsWithPercentage;
};

export const useShapeBuildLabels = ({
  t,
  buildStatus,
  effectiveStatus,
  effectiveProgress,
  stages,
  resolvedTaskType,
  displayStageId,
  rawDisplayCounts,
}: Args) => {
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

  const warningMessage = useMemo(() => {
    if (buildStatus !== 'paused') return null;
    const message = effectiveStatus?.error;
    if (typeof message !== 'string') return null;
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [buildStatus, effectiveStatus?.error]);

  const stageLabel = useMemo(() => {
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
  }, [buildStatus, displayStageId, stages, t]);

  const taskLabel = useMemo(() => {
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
  }, [buildStatus, effectiveProgress?.message, effectiveStatus?.error, rawDisplayCounts, resolvedTaskType, stages, t]);

  const taskUnitLabel = t('stage.progress.taskUnitTasks', 'Tasks');

  return {
    statusLabel,
    warningMessage,
    stageLabel,
    taskLabel,
    taskUnitLabel,
  };
};
