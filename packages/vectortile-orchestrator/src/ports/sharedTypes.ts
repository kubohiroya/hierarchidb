import type { NodeId } from '@hierarchidb/core-types';

export type ProcessingStage = string;

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: ProcessingStage | 'processing' | 'vectortile';
}

export interface VectorTileTask {
  taskId: string;
  nodeId?: NodeId;
  stage?: string;
  status?: string;
  type?: string;
  index?: number;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  retryCount?: number;
  error?: string;
}
