/**
 * Aggregation-oriented worker runtime API responsibilities.
 * Keeps metrics, status, progress, and snapshot calculation entrypoints.
 */
import { shapeBuildRuntimeExecutionMetrics } from './shapeBuildRuntimeExecutionMetrics.js';

export const shapeBuildRuntimeAggregation = {
  countTaskQueueStatuses: shapeBuildRuntimeExecutionMetrics.countTaskQueueStatuses,
  resolveSessionExpiresAt: shapeBuildRuntimeExecutionMetrics.resolveSessionExpiresAt,
  resolveProgressPhase: shapeBuildRuntimeExecutionMetrics.resolveProgressPhase,
  buildProgressPayloadFromTasks: shapeBuildRuntimeExecutionMetrics.buildProgressPayloadFromTasks,
  selectLatestTaskByProgress: shapeBuildRuntimeExecutionMetrics.selectLatestTaskByProgress,
  resolveTaskProcessingTimestamp: shapeBuildRuntimeExecutionMetrics.resolveTaskProcessingTimestamp,
  emitProgressSnapshot: shapeBuildRuntimeExecutionMetrics.emitProgressSnapshot,
} as const;

export type ShapeBuildRuntimeAggregation = typeof shapeBuildRuntimeAggregation;
