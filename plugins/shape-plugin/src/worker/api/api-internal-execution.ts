/**
 * Internal execution API assembly for shape build runtime.
 *
 * - shapeBuildRuntimeExecutionControl: control commands and execution orchestration.
 * - shapeBuildRuntimeCore: session state, progress, and events aggregation.
 * This module merges both responsibilities into the runtime API surface used by API assembly.
 */

import { shapeBuildRuntimeExecutionControl } from './shapeBuildRuntimeExecutionControl.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimeCore,
  ...shapeBuildRuntimeExecutionControl,
} as const;