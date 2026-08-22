import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { ShapeEntity } from '~/common/types/index';
import { summarizeCheckboxState } from '~/common/types/index';

export type BuildStartupTransitionWarnStep = 0 | 1 | 2 | 3;

export const resolveDisplayBuildStatus = (params: {
  baseBuildStatus: BuildStatus;
  tasksCompletionStatus: BuildStatus | null;
  hasInFlightTasks: boolean;
}): BuildStatus => {
  if (params.tasksCompletionStatus === 'failed') {
    return 'failed';
  }
  if (params.baseBuildStatus === 'running') {
    return 'running';
  }
  if (params.tasksCompletionStatus === 'completed') {
    return params.baseBuildStatus === 'paused' ? 'paused' : 'completed';
  }
  if (params.baseBuildStatus === 'paused') {
    return 'paused';
  }
  if (params.hasInFlightTasks) {
    return 'running';
  }
  return params.baseBuildStatus;
};

export const shouldRefreshTasksSnapshot = (params: {
  displayTaskCount: number;
  hasInFlightTasks: boolean;
  hasProgressTaskSignal: boolean;
  buildStatus: BuildStatus;
  runtimeStatus: string | null;
  processingStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  buildSessionTransitionActive: boolean;
  isTaskSnapshotProgressConnected?: boolean;
}): boolean => {
  if (params.isTaskSnapshotProgressConnected) {
    return false;
  }
  const hasProcessingSignal =
    params.buildStatus === 'running' ||
    params.runtimeStatus === 'running' ||
    params.processingStatus === 'running' ||
    params.buildSessionTransitionActive;
  if (params.displayTaskCount === 0) {
    return (
      params.hasProgressTaskSignal || hasProcessingSignal || params.buildStatus === 'completed'
    );
  }
  if (params.hasInFlightTasks) {
    return false;
  }
  return hasProcessingSignal;
};

export const summarizeSelectionStateFromConfig = (
  data?: Partial<ShapeEntity>
): { hasSelection: boolean } => {
  return summarizeCheckboxState(data?.selectedArrayByCountries).hasSelection
    ? { hasSelection: true }
    : { hasSelection: false };
};

export const toBuildStatus = (status?: string | null): BuildStatus => {
  switch (status) {
    case 'running':
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

export const toProcessingStatus = (
  status?: string | null
): 'idle' | 'running' | 'paused' | 'completed' | 'failed' => {
  switch (status) {
    case 'running':
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
