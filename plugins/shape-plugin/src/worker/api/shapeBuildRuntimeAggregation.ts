/**
 * Aggregation-oriented worker runtime API responsibilities.
 * Keeps metrics, status, progress, and snapshot calculation entrypoints.
 */
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';
import { selectLatestTaskByProgress, resolveTaskProcessingTimestamp } from '../taskOrderingConstants.js';

export const shapeBuildRuntimeAggregation = {
  countTaskQueueStatuses: shapeBuildRuntimeCore.countTaskQueueStatuses,
  resolveSessionExpiresAt: shapeBuildRuntimeCore.resolveSessionExpiresAt,
  resolveBuildStatus: shapeBuildRuntimeCore.resolveBuildStatus,
  selectLatestTaskByProgress,
  resolveTaskProcessingTimestamp,
} as const;

export type ShapeBuildRuntimeAggregation = typeof shapeBuildRuntimeAggregation;
