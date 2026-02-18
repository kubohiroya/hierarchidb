import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { isTaskPhaseDisplay, isTaskPhaseMessage } from '../../../common/utils/taskMessages.ts';

export type TranslateFn = (key: string, fallback?: string, options?: Record<string, unknown>) => string;

export const isGenericFailureMessage = (task: ShapeBuildTaskSummary): boolean => {
  const message = typeof task.message === 'string' ? task.message.trim() : '';
  const normalized = message.toLowerCase();
  return (
    !message
    || normalized === 'failed'
    || normalized === 'stage task failed'
    || isTaskPhaseMessage(message)
    || isTaskPhaseDisplay(task.display)
  );
};

export const resolveFailureMessage = (task: ShapeBuildTaskSummary): string | null => {
  const message = typeof task.message === 'string' ? task.message.trim() : '';
  const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
  const error = typeof task.error === 'string' ? task.error.trim() : '';
  const fallback = errorMessage || error;
  if (fallback && isGenericFailureMessage(task)) return fallback;
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
