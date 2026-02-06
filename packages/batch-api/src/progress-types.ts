/**
 * Unified progress event types for batch processing.
 */
export type BatchStage = 'fetch' | 'transform' | 'vt' | 'completed' | string;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';
