/**
 * Shape Build Runtime Core
 *
 * Core runtime functions integration for shape build sessions, task management, and progress tracking
 */

import type { NodeId } from '@hierarchidb/core-types';
import { listTasks, onTaskQueueUpdate, type VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { countTaskQueueStatuses, ensureTaskQueueSeeded } from './taskQueueManagement.js';
import {
  mapTaskQueueRecordToTaskSummary,
  type ShapeBuildTaskSummary,
} from './taskSummaryMapping.js';

// Re-export from progress analysis
export { buildTaskQueueSummary } from './progressAnalysis.js';
// Re-export from session configuration
export {
  getBuildSessionInternal,
  getShapeEntityHandler,
  resolveSessionExpiresAt,
} from './sessionConfigurationConstants.js';

// Re-export from state management
export {
  clearActivePipeline,
  getActivePipeline,
  getPauseState,
  heartbeatCallbacks,
  invalidateActivePipeline,
  isActivePipelineRunCurrent,
  registerActivePipeline,
  resolveBuildStatus,
  resolveSessionLastActivity,
  resolveSessionStatus,
  sessionStateCallbacks,
  setPaused,
  stageSnapshotCallbacks,
  type TaskSubscription,
  taskCallbacks,
  taskProgressCallbacks,
  waitIfPaused,
  workerLogCallbacks,
} from './stateManagement.js';

// Task summary snapshot building
export const buildTaskSummarySnapshot = async (
  nodeId: NodeId,
  taskQueue: VtTaskQueueDb
): Promise<ShapeBuildTaskSummary[]> => {
  const tasks = await listTasks(taskQueue, nodeId);
  const statusSummary: Record<string, number> = {};
  const stageSummary: Record<string, number> = {};
  for (const task of tasks) {
    statusSummary[task.status] = (statusSummary[task.status] ?? 0) + 1;
    stageSummary[task.stage] = (stageSummary[task.stage] ?? 0) + 1;
  }
  console.log(
    '[shapeBuildRuntime] buildTaskSummarySnapshot',
    JSON.stringify({
      nodeId,
      total: tasks.length,
      statusSummary,
      stageSummary,
    })
  );
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
