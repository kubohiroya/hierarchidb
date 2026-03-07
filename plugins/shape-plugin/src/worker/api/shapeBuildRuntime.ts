/**
 * Internal worker API runtime assembly
 * for shape plugin build API.
 */
import { shapeBuildRuntimeAggregation } from './shapeBuildRuntimeAggregation.js';
import { shapeBuildRuntimePublic } from './shapeBuildRuntimePublic.js';
import { shapeBuildRuntime as shapeBuildRuntimeExecution } from './api-internal-execution.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimePublic,
  ...shapeBuildRuntimeAggregation,
  ...shapeBuildRuntimeCore,
  startBuildSessionInternal: shapeBuildRuntimeExecution.startBuildSessionInternal,
  invokeShapeBuildCommand: shapeBuildRuntimeExecution.invokeShapeBuildCommand,
};

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
