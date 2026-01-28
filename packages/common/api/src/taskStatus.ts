import type { BatchSessionStatus, ProgressPhase } from './BatchControlAPI.js';

export const normalizeProgressPhase = (status?: string | null): ProgressPhase => {
  if (!status) return 'queued';
  const normalized = status.toString().toLowerCase();
  switch (normalized) {
    case 'success':
      return 'completed';
    case 'error':
      return 'failed';
    case 'process':
      return 'running';
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'paused':
      return 'paused';
    case 'regression':
      return 'regression';
    case 'warning':
      return 'warning';
    default:
      return 'queued';
  }
};

export const mapProgressPhaseToBatchStatus = (
  phase?: ProgressPhase | string | null,
): BatchSessionStatus['status'] => {
  const normalized = normalizeProgressPhase(phase ?? undefined);
  switch (normalized) {
    case 'completed':
      return 'completed';
    case 'failed':
    case 'regression':
      return 'failed';
    case 'paused':
      return 'paused';
    case 'queued':
      return 'idle';
    case 'warning':
    case 'running':
    default:
      return 'running';
  }
};
