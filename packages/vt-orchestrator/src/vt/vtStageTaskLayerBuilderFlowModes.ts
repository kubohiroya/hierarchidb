import { buildByContinentGrouping } from './vtStageTaskLayerBuilderFlowModesHandlerBuildByContinent.js';
import { isLayerBuildExecutionMode } from './vtStageTaskLayerBuilderPolicy.js';
import { type LayerBuildExecutionMode } from './vtStageTaskLayerBuilderPolicy.js';
import { buildMultiLayer } from './vtStageTaskLayerBuilderFlowModesHandlerBuildMultiLayer.js';
import { buildPerTile } from './vtStageTaskLayerBuilderFlowModesHandlerBuildPerTile.js';
import { buildSingleLayer } from './vtStageTaskLayerBuilderFlowModesHandlerBuildSingleLayer.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

type LayerBuildModeHandler = (input: LayerBuildFlowInput) => Promise<VtLayerBuildResult>;
const executeLayerBuildByPolicyByMode: Record<LayerBuildExecutionMode, LayerBuildModeHandler> = {
  buildByContinentGrouping,
  buildPerTile,
  buildSingleLayer,
  buildMultiLayer,
};

export const executeLayerBuildByPolicy = async (input: LayerBuildFlowInput) => {
  const mode = input.layerBuildPolicy.mode;
  if (!isLayerBuildExecutionMode(mode)) {
    throw new Error(`[vt] unexpected skip mode in layer build flow: ${mode}`);
  }
  const handler: LayerBuildModeHandler = executeLayerBuildByPolicyByMode[mode];
  return handler(input);
};
