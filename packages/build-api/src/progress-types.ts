/** 
 * Unified progress event types for build processing.
 */
export type BuildStage = 'source' | 'geometry' | 'tileEmit' | 'completed' | string;

export type BuildContinuationPolicy =
  | 'finish_all_stages'
  | 'finish_stage_then_stop'
  | 'stop_on_first_error';
