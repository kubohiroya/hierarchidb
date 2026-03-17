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
 * phase field is intentionally absent (managed by sessionStatusUpdated only).
 */
export interface TaskProgressUpdatedEvent {
  type: 'taskProgressUpdated';
  payload: {
    stageId: string;
    value: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}
