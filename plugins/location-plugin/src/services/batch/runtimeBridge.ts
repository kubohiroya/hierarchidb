import type { BatchProgressEvent, BatchSessionStatus, ProgressPhase } from '@hierarchidb/common-api';

const stageMap: Record<string, BatchProgressEvent['stage']> = {
  download: 'download',
  filter: 'simplify1',
  cluster: 'simplify2',
  index: 'vectortile',
};

type LocationSessionStatus = Extract<BatchSessionStatus['status'], 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'>;

export const mapStageToBatchStage = (stage?: string): BatchProgressEvent['stage'] => {
  if (!stage) return 'download';
  return stageMap[stage] ?? (stage as BatchProgressEvent['stage']);
};

export const mapManagerStatusToLocationStatus = (phase: ProgressPhase | BatchSessionStatus['status']): LocationSessionStatus => {
  if (phase === 'paused' || phase === 'completed' || phase === 'failed' || phase === 'cancelled') {
    return phase;
  }
  return 'running';
};

export interface ProgressSnapshot {
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
}

export const toProgressSnapshot = (event: BatchProgressEvent): ProgressSnapshot => {
  const total = event.payload?.total ?? 0;
  const completed = event.payload?.completed ?? 0;
  const failed = event.payload?.failed ?? 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    failed,
    percentage,
    currentStage: event.stage,
    currentTask: event.payload?.currentTask,
  };
};
