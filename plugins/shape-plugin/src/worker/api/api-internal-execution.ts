/**
 * Worker API execution runtime assembly for Shape plugin.
 *
 * - shapeBuildRuntimeExecutionControl: control commands and execution orchestration.
 * - shapeBuildRuntimeExecutionMetrics: session state, progress, and events aggregation.
 * This module merges both responsibilities into the runtime API surface used by API assembly.
 */

import { shapeBuildRuntimeExecutionControl } from './api-internal-execution-core.js';
import { shapeBuildRuntimeExecutionMetrics } from './api-internal-execution-metrics.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimeExecutionMetrics,
  ...shapeBuildRuntimeExecutionControl,
} as const;

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
