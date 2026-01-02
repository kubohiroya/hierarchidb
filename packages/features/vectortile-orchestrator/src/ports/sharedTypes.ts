import type { NodeId } from '@hierarchidb/common-types';

export type ProcessingStage = string;

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: ProcessingStage | 'processing';
  currentTask?: string;
}

export interface VectorTileTask {
  taskId: string;
  taskType: string;
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
