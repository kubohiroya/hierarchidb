/**
 * Aggregation-oriented worker runtime API responsibilities.
 * Keeps metrics, status, progress, and snapshot calculation entrypoints.
 */

import {
  resolveTaskProcessingTimestamp,
  selectLatestTaskByProgress,
} from '../taskOrderingConstants.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';

export const shapeBuildRuntimeAggregation = {
  countTaskQueueStatuses: shapeBuildRuntimeCore.countTaskQueueStatuses,
  resolveSessionExpiresAt: shapeBuildRuntimeCore.resolveSessionExpiresAt,
  resolveBuildStatus: shapeBuildRuntimeCore.resolveBuildStatus,
  selectLatestTaskByProgress,
  resolveTaskProcessingTimestamp,
} as const;

export type ShapeBuildRuntimeAggregation = typeof shapeBuildRuntimeAggregation;
