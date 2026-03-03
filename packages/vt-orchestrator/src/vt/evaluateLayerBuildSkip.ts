import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import { buildSkipResultIfNeeded } from './buildSkipResultIfNeeded.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';

export const evaluateLayerBuildSkip = (
  input: LayerBuildFlowInput,
): VtLayerBuildResult | null => {
  return buildSkipResultIfNeeded({
    taskContext: input.taskContext,
    parent: input.parent,
    layerBuildPolicy: input.layerBuildPolicy,
    totalFeatures: input.collection.features.length,
    featureStats: input.featureStats,
    completedWithParentInputSummary: input.completedWithParentInputSummary,
  });
};
