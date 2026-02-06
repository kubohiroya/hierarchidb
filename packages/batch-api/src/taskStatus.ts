import type { BatchSessionStatus, ProgressPhase } from './BatchControlAPI.js';

const phaseValues: Set<ProgressPhase> = new Set([
  'idle',
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'regression',
  'warning',
]);

export const normalizeProgressPhase = (status?: string | null): ProgressPhase => {
  if (!status) return 'idle';
  const normalized = status.toLowerCase();
  if (normalized === 'error') return 'failed';
  if (phaseValues.has(normalized as ProgressPhase)) {
    return normalized as ProgressPhase;
  }
  return 'idle';
};

export const mapProgressPhaseToBatchStatus = (
  phase?: ProgressPhase | string | null
): BatchSessionStatus['status'] => normalizeProgressPhase(phase ?? null);
