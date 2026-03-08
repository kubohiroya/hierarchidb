/**
 * Event Emission
 * 
 * Handles unconditional event streaming for session state, task progress, and stage snapshots
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BuildTaskUpdateEvent, TaskQueueRecord } from '@hierarchidb/build-api';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type {
    SessionStateChangeEvent,
    StageSnapshotEvent,
    TaskProgressEvent,
    WorkerLogEvent,
    CriticalErrorEvent,
} from '~/common/types/session-events';
import { VtTaskQueueDb, listTasks, listTasksByStage } from '@hierarchidb/vt-orchestrator';
import { unconditionalEventStreamer } from './eventBuffering.js';
import { mapTaskQueueRecordToTaskSummary } from './taskSummaryMapping.js';

// Worker log event type
export const emitWorkerLog = (
    nodeId: NodeId,
    level: 'log' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
): void => {
    const event: WorkerLogEvent = {
        nodeId,
        timestamp: Date.now(),
        level,
        message,
        data,
    };

    // Emit log event to UI
    unconditionalEventStreamer.emitEvent(nodeId, 'worker-log', event);
    
    // Also log to worker console
    const logData = data ? [message, data] : [message];
    switch (level) {
        case 'log':
            console.log('[Worker]', ...logData);
            break;
        case 'warn':
            console.warn('[Worker]', ...logData);
            break;
        case 'error':
            console.error('[Worker]', ...logData);
            break;
    }
};

// Critical error event type (for contract violations and critical failures)
export const emitCriticalError = (
    nodeId: NodeId,
    message: string,
    error: unknown,
    contractViolation: boolean = false,
): void => {
    const errorString = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    const event: CriticalErrorEvent = {
        nodeId,
        timestamp: Date.now(),
        message,
        error: errorString,
        errorName,
        severity: 'critical',
        contractViolation,
    };

    // Emit critical error event to UI
    unconditionalEventStreamer.emitEvent(nodeId, 'critical-error', event);
    
    // Log to worker console with contract violation indicator
    const contractIndicator = contractViolation ? '🚨 CONTRACT VIOLATION' : '';
    const logMessage = `${contractIndicator} Critical Error: ${message}`;
    const logData = { error: errorString, errorName, contractViolation };
    
    console.error('[Worker]', logMessage, logData);
};

export const emitSessionStateChange = (
    nodeId: NodeId,
    previousStatus: ShapeBuildSessionRecord['status'] | undefined,
    currentStatus: ShapeBuildSessionRecord['status'],
    sessionRecord: ShapeBuildSessionRecord,
): void => {
    const event: SessionStateChangeEvent = {
        nodeId,
        timestamp: Date.now(),
        previousStatus,
        currentStatus,
        sessionRecord,
    };

    // Emit unconditionally regardless of UI state
    unconditionalEventStreamer.emitEvent(nodeId, 'session-state', event);
};

export const emitTaskProgress = (
    nodeId: NodeId,
    taskId: string,
    stage: string,
    progress: number,
    status: string,
    metadata?: Record<string, unknown>,
): void => {
    const event: TaskProgressEvent = {
        nodeId,
        timestamp: Date.now(),
        taskId,
        stage,
        progress,
        status,
        metadata,
    };

    // Emit unconditionally regardless of UI state
    unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', event);
};

export const emitStageSnapshot = (
    nodeId: NodeId,
    stageId: string,
    snapshot: Record<string, unknown>,
): void => {
    const event: StageSnapshotEvent = {
        nodeId,
        timestamp: Date.now(),
        stageId,
        snapshot,
    };

    // Emit unconditionally regardless of UI state
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', event);
};

export const emitTaskSnapshot = async (
    nodeId: NodeId,
    options?: { stage?: TaskQueueRecord['stage'] },
    taskCallbacks?: Map<string, any>, // For backward compatibility
): Promise<void> => {
    const taskQueue = new VtTaskQueueDb();
    const tasks = options?.stage
        ? await listTasksByStage(taskQueue, nodeId, options.stage)
        : await listTasks(taskQueue, nodeId);
    const snapshot = tasks.map((task) => mapTaskQueueRecordToTaskSummary(task));
    const snapshotVersion = snapshot.length > 0
        ? snapshot.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER)
        : 0;

    // Create stage snapshot event for unconditional streaming
    const stageSnapshotEvent: StageSnapshotEvent = {
        nodeId,
        timestamp: Date.now(),
        stageId: options?.stage ?? 'all-stages',
        snapshot: {
            tasks: snapshot,
            version: snapshotVersion,
            stage: options?.stage,
        },
    };

    // Emit unconditionally regardless of UI state
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', stageSnapshotEvent);

    // Also maintain backward compatibility with direct task callbacks for now
    if (taskCallbacks) {
        const key = String(nodeId);
        const subscription = taskCallbacks.get(key);
        if (subscription?.callback) {
            subscription.callback({
                type: 'snapshot',
                nodeId,
                tasks: snapshot,
                version: snapshotVersion,
                stage: options?.stage,
            } as BuildTaskUpdateEvent & {
                version: number;
                stage?: TaskQueueRecord['stage'];
            });
        }
    }
};

export const emitProgressSnapshot = async (
    nodeId: NodeId,
    message?: string,
): Promise<void> => {
    // Create a progress snapshot event for unconditional streaming
    const progressSnapshotEvent: StageSnapshotEvent = {
        nodeId,
        timestamp: Date.now(),
        stageId: 'progress-snapshot',
        snapshot: {
            message: message ?? 'Progress update',
            timestamp: Date.now(),
        },
    };

    // Emit unconditionally regardless of UI state
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', progressSnapshotEvent);
};