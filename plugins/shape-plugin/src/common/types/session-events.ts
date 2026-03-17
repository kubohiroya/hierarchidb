/**
 * Re-exports canonical Worker→UI event types from @hierarchidb/build-api.
 * These types are defined in docs/build-session-worker-ui-event-spec.md.
 */
export type {
    SessionPhase,
    SessionStatusUpdatedEvent,
    TaskSummary,
    StageSnapshotUpdatedEvent,
    TaskProgressUpdatedEvent,
    HeartbeatEvent,
    WorkerLogEvent,
    CriticalErrorEvent,
    CanonicalSessionEvent,
} from '@hierarchidb/build-api';
