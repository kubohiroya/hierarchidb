/**
 * Internal worker API runtime assembly
 * for shape plugin build API.
 */
import { shapeBuildRuntimeAggregation } from './shapeBuildRuntimeAggregation.js';
import { shapeBuildRuntimePublic } from './shapeBuildRuntimePublic.js';
import { shapeBuildRuntime as shapeBuildRuntimeExecution } from './api-internal-execution.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimePublic,
  ...shapeBuildRuntimeAggregation,
  startBuildSessionInternal: shapeBuildRuntimeExecution.startBuildSessionInternal,
  invokeShapeBuildCommand: shapeBuildRuntimeExecution.invokeShapeBuildCommand,
};

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
