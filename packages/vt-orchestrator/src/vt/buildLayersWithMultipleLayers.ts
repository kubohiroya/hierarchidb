import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contextTypes';
import type { BandConfig } from '~/types/types';
import { buildLayerIndexes } from './buildLayerIndexes.js';
import {
  collectLayerForTile,
  logLayerIndexBuildDone,
  logLayerIndexBuildStart,
} from './vtStageTaskLayerBuilderHelpers.js';
import {
  collectTileLayersToMap,
  mergeAggregatedLayerMaps,
} from './vtStageTaskLayerBuilderTileAggregation.js';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

export const buildLayersWithMultipleLayers = async ({
  context,
  taskContext,
  band,
  parent,
  layerMap,
  debugCollect,
  assertNotAborted,
  tileEmitConfigBoundaryDedupe,
}: {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  layerMap: Map<string, Feature<Geometry>[]>;
  debugCollect: boolean;
  assertNotAborted: (signal?: AbortSignal) => void;
  tileEmitConfigBoundaryDedupe: boolean;
}): Promise<Map<number, Record<string, Tile>>> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const [layerName, features] of layerMap.entries()) {
    if (features.length === 0) continue;
    assertNotAborted(context.abortSignal);
    const singleLayerMap = new Map<string, Feature<Geometry>[]>([[layerName, features]]);
    const logContext = {
      ...taskContext,
      layerName,
    };
    logLayerIndexBuildStart({
      taskContext: logContext,
      layerCount: singleLayerMap.size,
      debugCollect,
    });
    const layerIndexes = await buildLayerIndexes(context, singleLayerMap, band, taskContext);
    logLayerIndexBuildDone({
      taskContext: logContext,
      indexCount: layerIndexes.size,
      debugCollect,
    });
    const layerIndex = layerIndexes.get(layerName);
    if (!layerIndex) continue;
    const tileLayers = await collectTileLayersToMap({
      parent,
      band: {
        zMin: band.zMin,
        zMax: band.zMax,
      },
      assertNotAborted,
      abortSignal: context.abortSignal,
      collectLayersForTile: (z, x, y) => {
        const tile = collectLayerForTile(
          layerIndex,
          layerName,
          z,
          x,
          y,
          tileEmitConfigBoundaryDedupe
        );
        return tile ? { [layerName]: tile } : null;
      },
    });
    mergeAggregatedLayerMaps(aggregatedLayersByTileId, tileLayers);
  }
  return aggregatedLayersByTileId;
};
