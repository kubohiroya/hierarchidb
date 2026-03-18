/**
 * Canonical Worker→UI event types for build session state management.
 * Defined in docs/build-session-worker-ui-event-spec.md.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskProgressUpdatedEvent } from './progress-types.js';

export type { TaskProgressUpdatedEvent };

/**
 * Session lifecycle phase — canonical set per build-session-worker-ui-event-spec.md
 */
export type SessionPhase =
    | 'idle'
    | 'starting'
    | 'running'
    | 'pausing'
    | 'paused'
    | 'resuming'
    | 'finalizing'
    | 'completed'
    | 'failed';

/**
 * sessionStatusUpdated — replaces runtimeSnapshotReceived + sessionRecordReceived.
 * Emitted on every lifecycle phase change and on initial subscription.
 */
export interface SessionStatusUpdatedEvent {
    type: 'sessionStatusUpdated';
    payload: {
        nodeId: string;
        phase: SessionPhase;
        isActive: boolean;
        startedAt?: number;
        completedAt?: number;
        stopReason?: string;
        stageId?: string;
        inactiveMs?: number;
        stageStartedAt?: number;
        stageInactiveMs?: number;
    };
}

/**
 * Minimal task summary carried inside StageSnapshotUpdatedEvent.
 */
export interface TaskSummary {
    taskId: string;
    stage: string;
    status: string;
    progress: number;
    version: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}

/**
 * stageSnapshotUpdated — replaces taskSnapshotReceived + taskUpdated + taskDeleted.
 * Full replacement of the task list for one stage that has already started.
 * Must NOT be emitted for stages that have not yet started (stageStartedAt required).
 */
export interface StageSnapshotUpdatedEvent {
    type: 'stageSnapshotUpdated';
    payload: {
        stageId: string;
        tasks: TaskSummary[];
        stageStartedAt: number;   // required — only emitted after stage has started
        stageInactiveMs: number;
        stageCompletedAt?: number;
    };
}

/**
 * heartbeat — periodic liveness signal (~1 s interval).
 * Must not carry phase or task data.
 */
export interface HeartbeatEvent {
    type: 'heartbeat';
    payload: {
        nodeId: string;
        heartbeatAt: number;      // finite timestamp (ms) — violation throws
    };
}

/**
 * Worker log event (debugging / monitoring — not part of the 4-event canonical set).
 */
export interface WorkerLogEvent {
    nodeId: NodeId;
    timestamp: number;
    level: 'log' | 'warn' | 'error';
    message: string;
    data?: Record<string, unknown>;
}

/**
 * Critical error event (contract violation detected in UI layer).
 */
export interface CriticalErrorEvent {
    nodeId: NodeId;
    timestamp: number;
    message: string;
    error: string;
    errorName: string;
    severity: 'critical';
    contractViolation: boolean;
}

/**
 * Union of all canonical Worker→UI events.
 */
export type CanonicalSessionEvent =
    | SessionStatusUpdatedEvent
    | StageSnapshotUpdatedEvent
    | TaskProgressUpdatedEvent
    | HeartbeatEvent;
