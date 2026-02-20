/**
 * Internal worker API runtime assembly
 * for shape plugin build API.
 */
import { shapeBuildRuntimeAggregation } from './api-internal-aggregation.js';
import { shapeBuildRuntimePublic } from './api-internal-public.js';
import { shapeBuildRuntime as shapeBuildRuntimeExecution } from './api-internal-execution.js';

export const shapeBuildRuntime = {
  ...shapeBuildRuntimePublic,
  ...shapeBuildRuntimeAggregation,
  startBuildSessionInternal: shapeBuildRuntimeExecution.startBuildSessionInternal,
  invokeShapeBuildCommand: shapeBuildRuntimeExecution.invokeShapeBuildCommand,
};

export type ShapeBuildRuntime = typeof shapeBuildRuntime;
