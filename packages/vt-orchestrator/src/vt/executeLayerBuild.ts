import type { VTStageContext } from '~/contextTypes';
import { buildLayersForVtTask } from './buildLayersForVtTask.js';
import type { VtLayerBuildInput, VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import type { VtCollectionResult, VtLayerRunInput } from './vtStageTaskTypes.js';

type LayerBuildExecutorInput = {
  context: VTStageContext;
  runInput: VtLayerRunInput;
  collection: VtCollectionResult;
};

export const executeLayerBuild = async ({
  context,
  runInput,
  collection,
}: LayerBuildExecutorInput): Promise<VtLayerBuildResult> => {
  const {
    band,
    parent,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    debugCollect,
    totalTiles,
    intersectingFeatureCount,
    taskContext,
  } = runInput;

  const {
    collection: featureCollection,
    featuresByContinent,
    featureStats,
    buildCompletedResult,
  } = collection;

  const buildInput: VtLayerBuildInput = {
    context,
    taskContext,
    band,
    parent,
    collection: featureCollection,
    featuresByContinent,
    featureStats,
    debugCollect,
    debugFocusConfig: runInput.debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    totalTiles,
    intersectingFeatureCount,
    completedWithParentInputSummary: buildCompletedResult,
  };

  return buildLayersForVtTask(buildInput);
};
