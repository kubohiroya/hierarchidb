/**
 * Worker API execution runtime assembly for Shape plugin.
 *
 * - shapeBuildRuntimeExecutionControl: control commands and execution orchestration.
 * - shapeBuildRuntimeExecutionMetrics: session state, progress, and events aggregation.
 * This module merges both responsibilities into the runtime API surface used by API assembly.
 */

import { shapeBuildRuntimeExecutionControl } from './shapeBuildRuntimeExecutionControl.js';
import { shapeBuildRuntimeExecutionMetrics } from './shapeBuildRuntimeExecutionMetrics.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimeExecutionMetrics,
  ...shapeBuildRuntimeExecutionControl,
} as const;

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
