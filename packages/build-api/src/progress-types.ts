/** 
 * Unified progress event types for build processing.
 */
export type BuildStage = 'source' | 'geometry' | 'tileEmit' | 'completed' | string;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';

/**
 * taskProgressUpdated — progress value for a single task from a parallel worker.
 * value must be finite and in [0, 100] — violation throws.
 * version must be a finite positive integer — violation throws.
 * phase field is intentionally absent (managed by sessionStatusUpdated only).
 *
 * taskId + version enable per-task deduplication on the UI side:
 * events with version <= lastAppliedVersion[taskId] are dropped.
 */
export interface TaskProgressUpdatedEvent {
  type: 'taskProgressUpdated';
  payload: {
    taskId: string;
    version: number;
    stageId: string;
    value: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}
