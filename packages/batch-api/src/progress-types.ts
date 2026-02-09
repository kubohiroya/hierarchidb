/**
 * Unified progress event types for batch processing.
 */
/** @deprecated Use BuildStage. */
export type BatchStage = 'fetch' | 'transform' | 'vt' | 'completed' | string;
/** Preferred alias for BatchStage. */
export type BuildStage = BatchStage;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';
