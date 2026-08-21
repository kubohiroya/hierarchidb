/**
 * Public API surface for shape build runtime.
 * Keeps only the methods that are consumed by API surface callers.
 */
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';

export const shapeBuildRuntimePublic = {
  getBuildSessionInternal: shapeBuildRuntimeCore.getBuildSessionInternal,
  ensureTaskQueueSeeded: shapeBuildRuntimeCore.ensureTaskQueueSeeded,
  mapTaskQueueRecordToTaskSummary: shapeBuildRuntimeCore.mapTaskQueueRecordToTaskSummary,
  buildTaskQueueSummary: shapeBuildRuntimeCore.buildTaskQueueSummary,
  getPauseState: shapeBuildRuntimeCore.getPauseState,
  listTasks: shapeBuildRuntimeCore.listTasks,
  getShapeEntityHandler: shapeBuildRuntimeCore.getShapeEntityHandler,
  onTaskQueueUpdate: shapeBuildRuntimeCore.onTaskQueueUpdate,
  buildTaskSummarySnapshot: shapeBuildRuntimeCore.buildTaskSummarySnapshot,
  taskCallbacks: shapeBuildRuntimeCore.taskCallbacks,
  sessionStateCallbacks: shapeBuildRuntimeCore.sessionStateCallbacks,
  stageSnapshotCallbacks: shapeBuildRuntimeCore.stageSnapshotCallbacks,
  heartbeatCallbacks: shapeBuildRuntimeCore.heartbeatCallbacks,
  taskProgressCallbacks: shapeBuildRuntimeCore.taskProgressCallbacks,
} as const;
