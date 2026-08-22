/**
 * Internal worker API runtime assembly
 * for shape plugin build API.
 */

import { shapeBuildRuntime as shapeBuildRuntimeExecution } from './apiInternalExecutionConstants.js';
import { shapeBuildRuntimeAggregation } from './shapeBuildRuntimeAggregation.js';
import { shapeBuildRuntimeCore } from './shapeBuildRuntimeCore.js';
import { shapeBuildRuntimePublic } from './shapeBuildRuntimePublic.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimePublic,
  ...shapeBuildRuntimeAggregation,
  ...shapeBuildRuntimeCore,
  startBuildSessionInternal: shapeBuildRuntimeExecution.startBuildSessionInternal,
  invokeShapeBuildCommand: shapeBuildRuntimeExecution.invokeShapeBuildCommand,
};

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
