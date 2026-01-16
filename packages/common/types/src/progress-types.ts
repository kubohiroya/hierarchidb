import type { NodeId } from './id-types.js';

/**
 * Unified progress event types for batch processing.
 */
export type BatchStage =
  | 'fetch'
  | 'transform'
  | 'transform-by-zoom'
  | 'vt'
  | 'completed'
  | string;

export interface ProgressEvent {
  nodeId: NodeId;
  taskType: BatchStage;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  timestamp?: number;
  message?: string;
}
