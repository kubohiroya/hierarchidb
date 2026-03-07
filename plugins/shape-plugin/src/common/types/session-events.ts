import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';

/**
 * Session state change event for real-time subscription
 */
export interface SessionStateChangeEvent {
    nodeId: NodeId;
    timestamp: number;
    previousStatus?: ShapeBuildSessionRecord['status'];
    currentStatus: ShapeBuildSessionRecord['status'];
    sessionRecord: ShapeBuildSessionRecord;
}

/**
 * Stage snapshot replacement event
 */
export interface StageSnapshotEvent {
    nodeId: NodeId;
    timestamp: number;
    stageId: string;
    snapshot: Record<string, unknown>;
}

/**
 * Heartbeat event (1 second interval)
 */
export interface SessionHeartbeatEvent {
    nodeId: NodeId;
    timestamp: number;
    isActive: boolean;
    lastActivity: number;
}

/**
 * Task progress event (individual task updates)
 */
export interface TaskProgressEvent {
    nodeId: NodeId;
    timestamp: number;
    taskId: string;
    stage: string;
    progress: number;
    status: string;
    metadata?: Record<string, unknown>;
}

/**
 * Worker log event (for debugging and monitoring)
 */
export interface WorkerLogEvent {
    nodeId: NodeId;
    timestamp: number;
    level: 'log' | 'warn' | 'error';
    message: string;
    data?: Record<string, unknown>;
}

/**
 * Unified session event types
 */
export type SessionEvent =
    | SessionStateChangeEvent
    | StageSnapshotEvent
    | SessionHeartbeatEvent
    | TaskProgressEvent
    | WorkerLogEvent;

/**
 * Session event subscription callback
 */
export type SessionEventCallback = (event: SessionEvent) => void;

/**
 * Session subscription interfaces (specific callbacks for each event type)
 */
export interface SessionStateSubscription {
    unsubscribe?: () => void;
    callback?: (event: SessionStateChangeEvent) => void;
}

export interface StageSnapshotSubscription {
    unsubscribe?: () => void;
    callback?: (event: StageSnapshotEvent) => void;
}

export interface HeartbeatSubscription {
    unsubscribe?: () => void;
    callback?: (event: SessionHeartbeatEvent) => void;
}

export interface TaskProgressSubscription {
    unsubscribe?: () => void;
    callback?: (event: TaskProgressEvent) => void;
}

export interface WorkerLogSubscription {
    unsubscribe?: () => void;
    callback?: (event: WorkerLogEvent) => void;
}

/**
 * Session subscription interface (generic)
 */
export interface SessionSubscription {
    unsubscribe?: () => void;
    callback?: SessionEventCallback;
}