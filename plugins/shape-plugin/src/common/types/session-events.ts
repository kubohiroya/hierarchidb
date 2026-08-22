/**
 * Re-exports canonical Worker→UI event types from @hierarchidb/build-api.
 * These types are defined in docs/build-session-worker-ui-event-spec.md.
 */
export type {
  CanonicalSessionEvent,
  CriticalErrorEvent,
  HeartbeatEvent,
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  TaskSummary,
  WorkerLogEvent,
} from '@hierarchidb/build-api';
