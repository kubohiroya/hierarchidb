import type { NodeId } from './id-types.js';

/**
 * Unified progress event types for batch processing.
 */
export type BatchStage = 'fetch' | 'transform' | 'vt' | 'completed' | string;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';

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
