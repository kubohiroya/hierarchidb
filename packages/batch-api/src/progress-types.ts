/**
 * Unified progress event types for build processing.
 */
export type BuildStage = 'fetch' | 'transform' | 'vt' | 'completed' | string;

/** @deprecated Use BuildStage. */
export type BatchStage = BuildStage;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';
