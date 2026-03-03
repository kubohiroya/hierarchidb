import type { Feature, Geometry } from 'geojson';
import type { VTStageContext } from '~/contexts';
import type { BandConfig } from '~/types/types';
import { buildLayerIndexes } from './buildLayerIndexes.js';
import type {
  BuildLayerIndexForTile,
  LayerBuildBranchResult,
  TaskLayerContext,
} from './vtStageTaskLayerBuilderTypes.js';
import { buildLayerByFeatureIndex, calculateSingleLayerVertexStats } from './vtStageTaskLayerBuilderStrategySingleLayerPerFeature.js';
import {
  logLayerIndexBuildDone,
  logLayerIndexBuildStart,
} from './vtStageTaskLayerBuilderHelpers.js';

export const buildLayersWithSingleLayer = async (
  context: VTStageContext,
  taskContext: TaskLayerContext,
  band: BandConfig,
  parent: { z: number; x: number; y: number },
  layerMap: Map<string, Feature<Geometry>[]>,
  debugCollect: boolean,
  assertNotAborted: (signal?: AbortSignal) => void,
  buildLayerIndexForTile: BuildLayerIndexForTile,
): Promise<LayerBuildBranchResult> => {
  const entry = layerMap.entries().next();
  if (!entry.value) {
    return { aggregatedLayersByTileId: new Map(), indexes: null };
  }
  const [layerName, features] = entry.value;
  const perFeatureVertexThreshold = 20000;
  const perFeatureMaxVertices = 10000;
  const { layerVertexCount, maxFeatureVertices } = features
    ? calculateSingleLayerVertexStats(features)
    : { layerVertexCount: 0, maxFeatureVertices: 0 };
  const usePerFeatureIndex = layerVertexCount >= perFeatureVertexThreshold
    || maxFeatureVertices >= perFeatureMaxVertices;
  if (usePerFeatureIndex && features) {
    const aggregatedLayersByTileId = await buildLayerByFeatureIndex({
      context,
      taskContext,
      band,
      parent,
      layerName,
      features,
      assertNotAborted,
      buildLayerIndexForTile,
    });
    return { aggregatedLayersByTileId, indexes: null };
  }

  logLayerIndexBuildStart({
    taskContext,
    layerCount: layerMap.size,
    debugCollect,
  });
  const indexes = await buildLayerIndexes(context, layerMap, band, taskContext);
  logLayerIndexBuildDone({
    taskContext,
    indexCount: indexes.size,
    debugCollect,
  });
  return { aggregatedLayersByTileId: null, indexes };
};
