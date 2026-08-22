import type { Feature, Geometry } from 'geojson';
import type { VTStageContext } from '~/contextTypes';
import type { BandConfig } from '~/types/types';
import {
  executePerTileLayerBuild,
  type PerTileLayerExecutionResult,
} from './executePerTileLayerBuild.js';
import { type VtDebugFocusConfig } from './vtStageDebug.js';
import {
  logPerTileEmptyTilesSummary,
  logPerTileLayerNoResult,
} from './vtStageTaskLayerBuilderStrategyPerTileLogUtils.js';
import type {
  BuildLayerIndexForTile,
  LayerBuildBranchResult,
  TaskLayerContext,
} from './vtStageTaskLayerBuilderTypes.js';

export const buildLayersWithPerTileIndex = async ({
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
}: {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  layerMap: Map<string, Feature<Geometry>[]>;
  debugFocusConfig: VtDebugFocusConfig;
  assertNotAborted: (signal?: AbortSignal) => void;
  totalTiles: number;
  intersectingFeatureCount: number;
  buildLayerIndexForTile: BuildLayerIndexForTile;
}): Promise<LayerBuildBranchResult> => {
  const {
    aggregatedLayersByTileId,
    emptyTilesWithFeatures,
    layerStats,
  }: PerTileLayerExecutionResult = await executePerTileLayerBuild({
    context,
    taskContext,
    band,
    parent,
    layerMap,
    debugFocusConfig,
    assertNotAborted,
    buildLayerIndexForTile,
  });

  if (aggregatedLayersByTileId.size === 0) {
    logPerTileLayerNoResult({
      taskContext,
      parent,
      band,
      totalTiles,
      layerCount: layerMap.size,
      intersectingFeatureCount,
      layerStats,
    });
    return { aggregatedLayersByTileId, indexes: null };
  }
  if (emptyTilesWithFeatures.length > 0) {
    logPerTileEmptyTilesSummary({
      taskContext,
      parent,
      band,
      totalTiles,
      emptyTilesWithFeatures,
      debugFocusConfig,
    });
  }
  return { aggregatedLayersByTileId, indexes: null };
};
