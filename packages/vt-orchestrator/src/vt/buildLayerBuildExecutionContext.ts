import type { StageHandlerResult } from '~/types/types';
import { loadGeojsonVt } from './vtStageFeatureSourceUtils.js';
import { buildLayerMap } from './vtStageFeatureMetadataUtils.js';
import { createLayerIndexForTile } from './vtStageTaskLayerBuilderHelpers.js';
import { decideLayerBuildPolicy } from './vtStageTaskLayerBuilderPolicy.js';
import type { BuildLayerIndexForTile, VtLayerBuildInput } from './vtStageTaskLayerBuilderTypes.js';
import type { LayerMap } from './vtStageTaskLayerBuilderTypes.js';
import type { LayerBuildPolicy } from './vtStageTaskLayerBuilderPolicy.js';
import { logLayerBuildStart } from './logLayerBuildStart.js';

export type PreparedLayerBuildContext = {
  layerMap: LayerMap;
  continentLayerGroups: LayerMap;
  layerBuildPolicy: LayerBuildPolicy;
  buildLayerIndexForTile: BuildLayerIndexForTile;
  completedWithParentInputSummary: (message: string) => StageHandlerResult;
};

export const buildLayerBuildExecutionContext = async (
  input: Omit<VtLayerBuildInput, 'completedWithParentInputSummary'> & {
    completedWithParentInputSummary: (message: string) => StageHandlerResult;
  },
): Promise<PreparedLayerBuildContext> => {
  const {
    context,
    taskContext,
    band,
    collection,
    featuresByContinent,
    debugCollect,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    totalTiles,
    intersectingFeatureCount,
    completedWithParentInputSummary,
  } = input;

  const completed = (reason: string): StageHandlerResult => completedWithParentInputSummary(reason);
  const layerMap = buildLayerMap(collection);
  const continentLayerGroups = featuresByContinent ?? new Map();
  const layerBuildPolicy = decideLayerBuildPolicy({
    totalTiles,
    intersectingFeatureCount,
    useTopojsonTileSimplify,
    bandZMin: band.zMin,
    featureLayerCount: layerMap.size,
    groupByContinent,
    continentCount: continentLayerGroups.size,
  });

  logLayerBuildStart({
    taskContext,
    band,
    parent: input.parent,
    totalTiles,
  });

  const geojsonvt = await loadGeojsonVt();
  const buildLayerIndexForTile = createLayerIndexForTile({
    context,
    bandMaxZoom: band.zMax,
    geojsonVt: geojsonvt,
    useTopojsonTileSimplify,
    topojsonSimplify,
    debugCollect,
  });

  return {
    layerMap,
    continentLayerGroups,
    layerBuildPolicy,
    buildLayerIndexForTile,
    completedWithParentInputSummary: completed,
  };
};
