import { buildLayersWithPerTileIndex } from './vtStageTaskLayerBuilderStrategyPerTile.js';
import { buildLayerResultFromBranch } from './vtStageTaskLayerBuilderFlowModesUtils.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

export const buildPerTile = async (input: LayerBuildFlowInput): Promise<VtLayerBuildResult> => {
  const {
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugFocusConfig,
    totalTiles,
    intersectingFeatureCount,
    buildLayerIndexForTile,
    assertNotAborted,
    completedWithParentInputSummary,
  } = input;

  const branchResult = await buildLayersWithPerTileIndex({
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugFocusConfig,
    assertNotAborted,
    totalTiles,
    intersectingFeatureCount,
    buildLayerIndexForTile,
  });
  return buildLayerResultFromBranch({
    branchResult,
    taskContext,
    parent,
    completedWithParentInputSummary,
  });
};
