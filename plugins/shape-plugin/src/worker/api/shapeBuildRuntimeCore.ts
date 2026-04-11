/**
 * Shape Build Runtime Core
 * 
 * Core runtime functions integration for shape build sessions, task management, and progress tracking
 */

import type { NodeId } from '@hierarchidb/core-types';
import {
  VtTaskQueueDb,
  listTasks,
  onTaskQueueUpdate,
} from '@hierarchidb/vt-orchestrator';
import {
  type ShapeBuildTaskSummary,
  mapTaskQueueRecordToTaskSummary
} from './taskSummaryMapping.js';
import {
  countTaskQueueStatuses,
  ensureTaskQueueSeeded,
} from './taskQueueManagement.js';

// Re-export from session configuration
export {
  getShapeEntityHandler,
  getBuildSessionInternal,
  resolveSessionExpiresAt,
} from './sessionConfigurationConstants.js';

// Re-export from progress analysis
export {
  buildTaskQueueSummary,
  buildProgressPayloadFromTasks,
} from './progressAnalysis.js';

// Re-export from state management
export {
  type ProgressSubscription,
  type TaskSubscription,
  progressCallbacks,
  taskCallbacks,
  sessionStateCallbacks,
  stageSnapshotCallbacks,
  heartbeatCallbacks,
  taskProgressCallbacks,
  workerLogCallbacks,
  getPauseState,
  resolveSessionStatus,
  resolveSessionLastActivity,
  waitIfPaused,
  setPaused,
  resolveProgressPhase,
  setSessionAbortController,
  clearSessionAbortController,
  getSessionAbortController,
} from './stateManagement.js';

// Task summary snapshot building
export const buildTaskSummarySnapshot = async (
  nodeId: NodeId,
  taskQueue: VtTaskQueueDb,
): Promise<ShapeBuildTaskSummary[]> => {
  const tasks = await listTasks(taskQueue, nodeId);
  const statusSummary: Record<string, number> = {};
  const stageSummary: Record<string, number> = {};
  for (const task of tasks) {
    statusSummary[task.status] = (statusSummary[task.status] ?? 0) + 1;
    stageSummary[task.stage] = (stageSummary[task.stage] ?? 0) + 1;
  }
  console.log('[shapeBuildRuntime] buildTaskSummarySnapshot', JSON.stringify({
    nodeId,
    total: tasks.length,
    statusSummary,
    stageSummary,
  }));
  return tasks.map((task) => mapTaskQueueRecordToTaskSummary(task));
};

// Export all required functions for shapeBuildAPI
export {
  listTasks,
  onTaskQueueUpdate,
  countTaskQueueStatuses,
  ensureTaskQueueSeeded,
  mapTaskQueueRecordToTaskSummary,
};