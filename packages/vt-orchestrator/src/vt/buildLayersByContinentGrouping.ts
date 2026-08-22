import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contextTypes';
import type { BandConfig } from '~/types/types';
import { buildLayerIndexes } from './buildLayerIndexes.js';
import { buildLayerMap } from './vtStageFeatureMetadataUtils.js';
import {
  collectLayersForTileFromIndexes,
  logLayerIndexBuildDone,
  logLayerIndexBuildStart,
} from './vtStageTaskLayerBuilderHelpers.js';
import {
  collectTileLayersToMap,
  mergeAggregatedLayerMaps,
} from './vtStageTaskLayerBuilderTileAggregation.js';
import type { TaskLayerContext } from './vtStageTaskLayerBuilderTypes.js';

type Input = {
  context: VTStageContext;
  taskContext: TaskLayerContext;
  band: BandConfig;
  parent: { z: number; x: number; y: number };
  featuresByContinent: Map<string, Feature<Geometry>[]>;
  debugCollect: boolean;
  assertNotAborted: (signal?: AbortSignal) => void;
  tileEmitConfigBoundaryDedupe: boolean;
};

export const buildLayersByContinentGrouping = async ({
  context,
  taskContext,
  band,
  parent,
  featuresByContinent,
  debugCollect,
  assertNotAborted,
  tileEmitConfigBoundaryDedupe,
}: Input): Promise<Map<number, Record<string, Tile>>> => {
  const aggregatedLayersByTileId = new Map<number, Record<string, Tile>>();
  for (const [continent, features] of featuresByContinent.entries()) {
    if (features.length === 0) continue;
    const continentMap = buildLayerMap({ type: 'FeatureCollection', features });
    if (continentMap.size === 0) continue;
    const continentContext = {
      ...taskContext,
      continent,
    };
    logLayerIndexBuildStart({
      taskContext: continentContext,
      layerCount: continentMap.size,
      debugCollect,
    });
    const continentIndexes = await buildLayerIndexes(context, continentMap, band, {
      ...continentContext,
    });
    logLayerIndexBuildDone({
      taskContext: continentContext,
      indexCount: continentIndexes.size,
      debugCollect,
    });
    if (continentIndexes.size === 0) continue;
    const continentTileLayers = await collectTileLayersToMap({
      parent,
      band: {
        zMin: band.zMin,
        zMax: band.zMax,
      },
      assertNotAborted,
      abortSignal: context.abortSignal,
      collectLayersForTile: (z, x, y) =>
        collectLayersForTileFromIndexes(continentIndexes, z, x, y, tileEmitConfigBoundaryDedupe),
    });
    mergeAggregatedLayerMaps(aggregatedLayersByTileId, continentTileLayers);
  }
  return aggregatedLayersByTileId;
};
