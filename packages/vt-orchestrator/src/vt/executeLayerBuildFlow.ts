import { evaluateLayerBuildSkip } from './evaluateLayerBuildSkip.js';
import { executeLayerBuildByPolicy } from './executeLayerBuildByPolicy.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import { type VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

export const executeLayerBuildFlow = async (
  input: LayerBuildFlowInput
): Promise<VtLayerBuildResult> => {
  const skippedByPolicy = evaluateLayerBuildSkip(input);
  if (skippedByPolicy) {
    return skippedByPolicy;
  }

  return executeLayerBuildByPolicy(input);
};
