import { type VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import { executeLayerBuildByPolicy } from './vtStageTaskLayerBuilderFlowModes.js';
import { evaluateLayerBuildSkip } from './vtStageTaskLayerBuilderFlowGuard.js';

export const executeLayerBuildFlow = async (
  input: LayerBuildFlowInput,
): Promise<VtLayerBuildResult> => {
  const skippedByPolicy = evaluateLayerBuildSkip(input);
  if (skippedByPolicy) {
    return skippedByPolicy;
  }

  return executeLayerBuildByPolicy(input);
};
