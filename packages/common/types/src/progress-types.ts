/**
 * Unified progress event types for batch processing
 */

export type BatchStage = 'import' | 'normalize' | 'download' | 'simplify1' | 'simplify2' | 'tilegen' | 'vectorTiles' | 'completed' | string;

export interface ProgressEvent {
  sessionId: string;
  stage: BatchStage;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask: string;
  timestamp?: number;
}

