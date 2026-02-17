import type { BuildSessionStatus, ProgressPhase } from './BuildControlAPI.js';

const phaseValues: Set<ProgressPhase> = new Set([
  'idle',
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'recycled',
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

export const mapProgressPhaseToBuildStatus = (
  phase?: ProgressPhase | string | null
): BuildSessionStatus['status'] => normalizeProgressPhase(phase ?? null);
