/**
 * State Management
 * 
 * Handles pause state, session status, and progress phase management
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import type {
    ShapeBuildSessionRecord,
} from '@hierarchidb/shape-api';
import type {
    SessionStateSubscription,
    StageSnapshotSubscription,
    HeartbeatSubscription,
    TaskProgressSubscription,
} from '~/common/types/session-events';
import {
    resolveTaskActivityTimestamp,
    selectLatestTaskByProgress,
} from '../taskOrdering.js';
import { summarizeTaskQueueStatus } from './progressAnalysis.js';

// Core runtime state management
export interface ProgressSubscription {
    unsubscribe?: () => void;
    callback?: (event: any) => void;
}

export interface TaskSubscription {
    unsubscribe?: () => void;
    callback?: (event: BuildTaskUpdateEvent) => void;
}

type PauseState = {
    paused: boolean;
    waiters: Array<() => void>;
};

// Global state maps
export const progressCallbacks = new Map<string, ProgressSubscription>();
export const taskCallbacks = new Map<string, TaskSubscription>();
export const sessionStateCallbacks = new Map<string, SessionStateSubscription>();
export const stageSnapshotCallbacks = new Map<string, StageSnapshotSubscription>();
export const heartbeatCallbacks = new Map<string, HeartbeatSubscription>();
export const taskProgressCallbacks = new Map<string, TaskProgressSubscription>();
const pauseStates = new Map<string, PauseState>();

// Session status and pause state management
const resolveSessionStatus = (
    nodeId: NodeId,
    tasks: TaskQueueRecord[],
): ShapeBuildSessionRecord['status'] => {
    if (getPauseState(nodeId).paused) return 'paused';
    return summarizeTaskQueueStatus(tasks).status;
};

const resolveSessionLastActivity = (tasks: TaskQueueRecord[]): number => {
    const latest = selectLatestTaskByProgress(tasks);
    const timestamp = latest ? resolveTaskActivityTimestamp(latest) : Date.now();
    return timestamp > 0 ? timestamp : Date.now();
};

export const getPauseState = (nodeId: NodeId): PauseState => {
    const key = String(nodeId);
    const existing = pauseStates.get(key);
    if (existing) return existing;
    const state: PauseState = { paused: false, waiters: [] };
    pauseStates.set(key, state);
    return state;
};

const waitIfPaused = async (nodeId: NodeId): Promise<void> => {
    const state = getPauseState(nodeId);
    if (!state.paused) return;
    const startedAt = Date.now();
    console.warn('[shapeBuildRuntime][PauseTrace] wait-enter', {
        nodeId,
        waitersBefore: state.waiters.length,
    });
    await new Promise<void>((resolve) => {
        state.waiters.push(resolve);
    });
    console.warn('[shapeBuildRuntime][PauseTrace] wait-exit', {
        nodeId,
        durationMs: Date.now() - startedAt,
        waitersRemaining: state.waiters.length,
    });
};

const setPaused = (nodeId: NodeId, paused: boolean): void => {
    const state = getPauseState(nodeId);
    state.paused = paused;
    console.warn('[shapeBuildRuntime][PauseTrace] state-update', {
        nodeId,
        paused,
        waiters: state.waiters.length,
    });
    if (!paused && state.waiters.length > 0) {
        const pending = [...state.waiters];
        state.waiters.length = 0;
        pending.forEach((resolve) => { resolve() });
    }
};

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): any => {
    if (getPauseState(nodeId).paused) return 'paused';
    const status = summarizeTaskQueueStatus(tasks).status;
    switch (status) {
        case 'running':
            return 'running';
        case 'completed':
            return 'completed';
        case 'failed':
            return 'failed';
        default:
            return 'queued';
    }
};

// Export all required functions
export {
    resolveSessionStatus,
    resolveSessionLastActivity,
    waitIfPaused,
    setPaused,
    resolveProgressPhase,
};