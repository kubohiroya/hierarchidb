import type { BuildTaskSummary } from '@hierarchidb/build-api';
import type {
  BuildSessionLifecyclePhase,
  BuildSessionStateEvent,
} from '@hierarchidb/ui-build-sessions';

export type ShapeStageId = 'source' | 'geometry' | 'tileEmit';
export type ShapeSessionPhase = BuildSessionLifecyclePhase;
export type ShapeTaskSummary = BuildTaskSummary;
export type ShapeStateEvent = BuildSessionStateEvent<
  ShapeStageId,
  ShapeSessionPhase,
  ShapeTaskSummary
>;
