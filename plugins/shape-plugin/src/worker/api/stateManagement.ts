/**
 * State Management
 *
 * Handles pause state, session status, and progress phase management
 */

import type {
  BuildProgressEvent,
  BuildTaskUpdateEvent,
  ProgressPhase,
  TaskProgressUpdatedEvent,
  TaskQueueRecord,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { atom, createStore } from 'jotai/vanilla';
import type {
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  WorkerLogEvent,
} from '~/common/types/session-events';

// Subscription interfaces using the canonical 4-event types
export interface SessionStateSubscription {
  unsubscribe?: () => void;
  callback?: (event: SessionStatusUpdatedEvent) => void;
}

export interface StageSnapshotSubscription {
  unsubscribe?: () => void;
  callback?: (event: StageSnapshotUpdatedEvent) => void;
}

export interface HeartbeatSubscription {
  unsubscribe?: () => void;
  callback?: (event: HeartbeatEvent) => void;
}

export interface TaskProgressSubscription {
  unsubscribe?: () => void;
  callback?: (event: TaskProgressUpdatedEvent) => void;
}

export interface WorkerLogSubscription {
  unsubscribe?: () => void;
  callback?: (event: WorkerLogEvent) => void;
}

import {
  resolveTaskActivityTimestamp,
  selectLatestTaskByProgress,
} from '../taskOrderingConstants.js';
import { summarizeTaskQueueStatus } from './progressAnalysis.js';
import { taskStateProtection } from './taskStateProtection.js';

// Core runtime state management
export interface ProgressSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildProgressEvent) => void;
}

export interface TaskSubscription {
  unsubscribe?: () => void;
  callback?: (event: BuildTaskUpdateEvent) => void;
}

export type ActivePipelineRun = {
  readonly promise: Promise<void>;
  readonly abortController: AbortController;
  readonly runId: string;
};

export type PauseState = {
  readonly paused: boolean;
  readonly waiters: ReadonlyArray<() => void>;
  readonly activePipeline: ActivePipelineRun | null;
  readonly invalidatedRunId: string | null;
};

// Global state maps
export const progressCallbacks = new Map<string, ProgressSubscription>();
export const taskCallbacks = new Map<string, TaskSubscription>();
export const sessionStateCallbacks = new Map<string, SessionStateSubscription>();
export const stageSnapshotCallbacks = new Map<string, StageSnapshotSubscription>();
export const heartbeatCallbacks = new Map<string, HeartbeatSubscription>();
export const taskProgressCallbacks = new Map<string, TaskProgressSubscription>();
export const workerLogCallbacks = new Map<string, WorkerLogSubscription>();
const pauseStateByNodeIdAtom = atom<ReadonlyMap<string, PauseState>>(new Map());
const buildSessionRuntimeStore = createStore();

const createInitialPauseState = (): PauseState => ({
  paused: false,
  waiters: [],
  activePipeline: null,
  invalidatedRunId: null,
});

const replacePauseState = (
  nodeId: NodeId,
  update: (current: PauseState) => PauseState
): PauseState => {
  const key = String(nodeId);
  const states = buildSessionRuntimeStore.get(pauseStateByNodeIdAtom);
  const current = states.get(key) ?? createInitialPauseState();
  const next = update(current);
  const nextStates = new Map(states);
  nextStates.set(key, next);
  buildSessionRuntimeStore.set(pauseStateByNodeIdAtom, nextStates);
  return next;
};

// Session status and pause state management
const resolveSessionStatus = (
  nodeId: NodeId,
  tasks: TaskQueueRecord[]
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
  const states = buildSessionRuntimeStore.get(pauseStateByNodeIdAtom);
  const existing = states.get(key);
  if (existing) return existing;
  return replacePauseState(nodeId, () => createInitialPauseState());
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
    replacePauseState(nodeId, (current) => ({
      ...current,
      waiters: [...current.waiters, resolve],
    }));
  });
  console.warn('[shapeBuildRuntime][PauseTrace] wait-exit', {
    nodeId,
    durationMs: Date.now() - startedAt,
    waitersRemaining: getPauseState(nodeId).waiters.length,
  });
};

const setPaused = async (nodeId: NodeId, paused: boolean): Promise<void> => {
  const state = getPauseState(nodeId);

  // If pausing, verify and protect task states before setting pause
  if (paused && !state.paused) {
    try {
      // Verify all task states are consistent before pause
      const validationResults = await taskStateProtection.verifySessionTaskStates(nodeId);
      if (validationResults.length > 0) {
        console.error(
          '[shapeBuildRuntime][TaskStateProtection] Inconsistent task states detected before pause:',
          {
            nodeId,
            issues: validationResults,
          }
        );
        // Continue with pause but log the issues
      }
    } catch (error) {
      console.error(
        '[shapeBuildRuntime][TaskStateProtection] Failed to verify task states before pause:',
        {
          nodeId,
          error,
        }
      );
    }
  }

  let pending: ReadonlyArray<() => void> = [];
  const next = replacePauseState(nodeId, (current) => {
    if (!paused) pending = current.waiters;
    return {
      ...current,
      paused,
      waiters: paused ? current.waiters : [],
    };
  });
  console.warn('[shapeBuildRuntime][PauseTrace] state-update', {
    nodeId,
    paused,
    waiters: next.waiters.length,
  });

  if (!paused && pending.length > 0) {
    pending.forEach((resolve) => {
      resolve();
    });

    // Clear snapshots when resuming
    taskStateProtection.clearSnapshots(nodeId);
  }
};

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): ProgressPhase => {
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
  taskStateProtection,
};

export const registerActivePipeline = (nodeId: NodeId, activePipeline: ActivePipelineRun): void => {
  replacePauseState(nodeId, (current) => {
    if (current.activePipeline !== null) {
      throw new Error(
        `[shapeBuildRuntime] active pipeline already exists: ${String(nodeId)}:${current.activePipeline.runId}`
      );
    }
    return {
      ...current,
      activePipeline,
      invalidatedRunId: null,
    };
  });
};

export const clearActivePipeline = (nodeId: NodeId, runId: string): boolean => {
  if (getPauseState(nodeId).activePipeline?.runId !== runId) return false;
  replacePauseState(nodeId, (current) => ({
    ...current,
    activePipeline: null,
    invalidatedRunId: null,
  }));
  return true;
};

export const getActivePipeline = (nodeId: NodeId): ActivePipelineRun | null =>
  getPauseState(nodeId).activePipeline;

export const invalidateActivePipeline = (nodeId: NodeId, runId: string): boolean => {
  if (getPauseState(nodeId).activePipeline?.runId !== runId) return false;
  replacePauseState(nodeId, (current) => ({
    ...current,
    invalidatedRunId: runId,
  }));
  return true;
};

export const isActivePipelineRunCurrent = (nodeId: NodeId, runId: string): boolean => {
  const state = getPauseState(nodeId);
  return state.activePipeline?.runId === runId && state.invalidatedRunId !== runId;
};
