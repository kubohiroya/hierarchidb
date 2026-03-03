/**
 * Public-facing worker API runtime facade responsibilities.
 * Keeps only the methods that are consumed by API surface callers.
 */
import { shapeBuildRuntimeExecutionMetrics } from './api-internal-execution-metrics.js';

export const shapeBuildRuntimePublic = {
  getBuildSessionInternal: shapeBuildRuntimeExecutionMetrics.getBuildSessionInternal,
  ensureTaskQueueSeeded: shapeBuildRuntimeExecutionMetrics.ensureTaskQueueSeeded,
  mapTaskQueueRecordToTaskSummary: shapeBuildRuntimeExecutionMetrics.mapTaskQueueRecordToTaskSummary,
  buildTaskQueueSummary: shapeBuildRuntimeExecutionMetrics.buildTaskQueueSummary,
  getPauseState: shapeBuildRuntimeExecutionMetrics.getPauseState,
  listTasks: shapeBuildRuntimeExecutionMetrics.listTasks,
  getShapeEntityHandler: shapeBuildRuntimeExecutionMetrics.getShapeEntityHandler,
  onTaskQueueUpdate: shapeBuildRuntimeExecutionMetrics.onTaskQueueUpdate,
  buildTaskSummarySnapshot: shapeBuildRuntimeExecutionMetrics.buildTaskSummarySnapshot,
  progressCallbacks: shapeBuildRuntimeExecutionMetrics.progressCallbacks,
  taskCallbacks: shapeBuildRuntimeExecutionMetrics.taskCallbacks,
  sessionStateCallbacks: shapeBuildRuntimeExecutionMetrics.sessionStateCallbacks,
  stageSnapshotCallbacks: shapeBuildRuntimeExecutionMetrics.stageSnapshotCallbacks,
  heartbeatCallbacks: shapeBuildRuntimeExecutionMetrics.heartbeatCallbacks,
  taskProgressCallbacks: shapeBuildRuntimeExecutionMetrics.taskProgressCallbacks,
} as const;

export type ShapeBuildRuntimePublic = typeof shapeBuildRuntimePublic;
