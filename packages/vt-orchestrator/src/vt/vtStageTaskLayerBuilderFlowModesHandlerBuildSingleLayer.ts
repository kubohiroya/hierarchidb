import { buildLayersWithSingleLayer } from './vtStageTaskLayerBuilderStrategySingleLayer.js';
import { buildLayerResultFromBranch } from './vtStageTaskLayerBuilderFlowModesUtils.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

export const buildSingleLayer = async (
  input: LayerBuildFlowInput,
): Promise<VtLayerBuildResult> => {
  const {
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugCollect,
    assertNotAborted,
    buildLayerIndexForTile,
    completedWithParentInputSummary,
  } = input;

  const branchResult = await buildLayersWithSingleLayer(
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugCollect,
    assertNotAborted,
    buildLayerIndexForTile,
  );
  return buildLayerResultFromBranch({
    branchResult,
    taskContext,
    parent,
    completedWithParentInputSummary,
  });
};
