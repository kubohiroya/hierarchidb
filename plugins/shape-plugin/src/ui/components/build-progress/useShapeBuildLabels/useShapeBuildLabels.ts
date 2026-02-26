import { useMemo } from 'react';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { TaskCountSummary } from '@hierarchidb/ui-build-sessions';
import type { BuildProgress, BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { formatTaskDisplayMessage } from '~/ui/components/build-progress/taskDisplayText';

type Translate = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

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
    const progressDisplay = effectiveProgress?.progressTaskDisplay;
    if (buildStatus === 'running' && progressDisplay?.kind === 'info') {
      const key = typeof progressDisplay.key === 'string' ? progressDisplay.key : '';
      if (key.startsWith('stage.taskWarning.')) {
        const warning = formatTaskDisplayMessage(progressDisplay, t);
        if (warning) return warning;
      }
    }
    if (buildStatus !== 'paused') return null;
    const message = effectiveStatus?.error;
    if (typeof message !== 'string') return null;
    const trimmed = message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [buildStatus, effectiveProgress?.progressTaskDisplay, effectiveStatus?.error, t]);

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
    const progressTaskMessage = formatTaskDisplayMessage(effectiveProgress?.progressTaskDisplay, t)
      ?? effectiveProgress?.message;
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
      if (progressTaskMessage) return progressTaskMessage;
      return t('stage.progress.ready', 'Ready');
    }
    return progressTaskMessage
      ?? (resolvedTaskType ? stages.find((stage) => stage.id === resolvedTaskType)?.title ?? resolvedTaskType : undefined)
      ?? effectiveStatus?.error
      ?? t('stage.progress.working', 'Working...');
  }, [
    buildStatus,
    effectiveProgress?.message,
    effectiveProgress?.progressTaskDisplay,
    effectiveStatus?.error,
    rawDisplayCounts,
    resolvedTaskType,
    stages,
    t,
  ]);

  const taskUnitLabel = t('stage.progress.taskUnitTasks', 'Tasks');

  return {
    statusLabel,
    warningMessage,
    stageLabel,
    taskLabel,
    taskUnitLabel,
  };
};
