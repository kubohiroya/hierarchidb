import { buildLayersByContinentGrouping } from './buildLayersByContinentGrouping.js';
import { buildLayerResultFromBranch } from './vtStageTaskLayerBuilderFlowModesUtils.js';
import type { LayerBuildFlowInput } from './vtStageTaskLayerBuilderFlowTypes.js';
import type { VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';

export const buildByContinentGrouping = async (
  input: LayerBuildFlowInput
): Promise<VtLayerBuildResult> => {
  const {
    context,
    taskContext,
    band,
    parent,
    continentLayerGroups,
    debugCollect,
    assertNotAborted,
    completedWithParentInputSummary,
  } = input;

  const aggregatedLayersByTileId = await buildLayersByContinentGrouping({
    context,
    taskContext,
    band,
    parent,
    featuresByContinent: continentLayerGroups,
    debugCollect,
    assertNotAborted,
    tileEmitConfigBoundaryDedupe: context.tileEmitConfig.boundaryDedupe,
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
      message: 'no layers after continent grouping',
      extra: {
        zRange: [band.zMin, band.zMax],
        continentCount: continentLayerGroups.size,
      },
    },
  });
};
