/**
 * Internal execution API assembly for shape build runtime.
 *
 * - shapeBuildRuntimeExecutionControl: control commands and execution orchestration.
 * - shapeBuildRuntimeCore: session state, progress, and events aggregation.
 * This module merges both responsibilities into the runtime API surface used by API assembly.
 */

import { shapeBuildRuntimeCore } from './shapeBuildRuntimeCore.js';
import { shapeBuildRuntimeExecutionControl } from './shapeBuildRuntimeExecutionControl.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimeCore,
  ...shapeBuildRuntimeExecutionControl,
} as const;
