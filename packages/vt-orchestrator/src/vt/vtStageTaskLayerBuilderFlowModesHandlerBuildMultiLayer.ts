import { buildLayersWithMultipleLayers } from './vtStageTaskLayerBuilderStrategyMultiLayer.js';
import { buildLayerResultFromBranch } from './vtStageTaskLayerBuilderFlowModesUtils.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

export const buildMultiLayer = async (
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
    completedWithParentInputSummary,
  } = input;

  const aggregatedLayersByTileId = await buildLayersWithMultipleLayers({
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugCollect,
    assertNotAborted,
    vtConfigBoundaryDedupe: context.vtConfig.boundaryDedupe,
  });
  return buildLayerResultFromBranch({
    branchResult: {
      aggregatedLayersByTileId,
      indexes: null,
    },
    taskContext,
    parent,
    completedWithParentInputSummary,
    logInput: {
      taskContext,
      parent,
      message: 'multi-layer index produced no layers',
      extra: {
        zRange: [band.zMin, band.zMax],
        layerCount: layerMap.size,
      },
    },
  });
};
