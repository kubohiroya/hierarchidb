import type { NodeId } from './id-types.js';

/**

 - Unified progress event types for batch processing
 */
export type BatchStage =
  | 'import'
  | 'normalize'
  | 'download'
  | 'extract1'
  | 'extract2'
  | 'tilegen'
  | 'vectorTiles'
  | 'completed'
  | string;

export interface ProgressEvent {
  nodeId: NodeId;
  stage: BatchStage;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask: string;
  timestamp?: number;
}
