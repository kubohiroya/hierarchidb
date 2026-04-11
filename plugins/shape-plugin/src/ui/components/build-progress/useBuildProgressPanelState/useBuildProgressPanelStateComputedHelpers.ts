import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import {
  isTaskPhaseDisplay,
  isTaskPhaseMessage,
  resolveTaskMetadataMessage,
} from '~/common/utils/taskMessageUtils';

export type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

const resolveTaskTextMessage = (task: ShapeBuildTaskSummary): string => {
  return resolveTaskMetadataMessage(task.metadata)?.trim() ?? '';
};

export const isGenericFailureMessage = (
  message: string | null | undefined,
  display?: ShapeBuildTaskSummary['display'],
): boolean => {
  if (!message) {
    return true;
  }
  const normalized = message.toLowerCase();
  return (
    normalized === 'failed'
    || normalized === 'stage task failed'
    || isTaskPhaseMessage(message)
    || isTaskPhaseDisplay(display)
  );
};

export const resolveFailureMessage = (task: ShapeBuildTaskSummary): string | null => {
  const message = resolveTaskTextMessage(task);
  const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
  const error = typeof task.error === 'string' ? task.error.trim() : '';
  const fallback = errorMessage || error;
  if (fallback && isGenericFailureMessage(message, task.display)) return fallback;
  if (message) return message;
  return fallback || null;
};

export const resolveCompletedStatusText = (
  buildStatus: BuildStatus,
  taskLabel: string | undefined,
  t: TranslateFn,
): string => {
  if (buildStatus === 'failed') {
    const candidate = taskLabel?.trim();
    if (candidate && candidate.toLowerCase() !== 'failed') return candidate;
    return t('stage.progress.failedReason', 'Build failed due to task errors.');
  }
  if (buildStatus === 'completed') {
    return t('stage.progress.completedReason', 'All tasks completed.');
  }
  return t('stage.progress.endedReason', 'Build ended.');
};
