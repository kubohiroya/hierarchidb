/**
 * Aggregation-oriented worker runtime API responsibilities.
 * Keeps metrics, status, progress, and snapshot calculation entrypoints.
 */
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';
import { selectLatestTaskByProgress, resolveTaskProcessingTimestamp } from '../taskOrdering.js';

export const shapeBuildRuntimeAggregation = {
  countTaskQueueStatuses: shapeBuildRuntimeCore.countTaskQueueStatuses,
  resolveSessionExpiresAt: shapeBuildRuntimeCore.resolveSessionExpiresAt,
  resolveProgressPhase: shapeBuildRuntimeCore.resolveProgressPhase,
  buildProgressPayloadFromTasks: shapeBuildRuntimeCore.buildProgressPayloadFromTasks,
  selectLatestTaskByProgress,
  resolveTaskProcessingTimestamp,
} as const;

export type ShapeBuildRuntimeAggregation = typeof shapeBuildRuntimeAggregation;