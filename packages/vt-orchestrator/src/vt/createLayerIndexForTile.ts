import type { Feature, Geometry } from 'geojson';
import type { Tile } from 'geojson-vt';
import type { VTStageContext } from '~/contextTypes';
import {
  buildTileLayerIndexFromFeatures,
} from './buildTileLayerIndexFromFeatures.js';

import type { FeatureCollectionLike } from './vtStageTaskLayerBuilderLayerHelpers.js';

export type GeojsonVtIndexFactory = (
  layerName: string,
  features: Feature<Geometry>[],
  z: number,
  x: number,
  y: number,
) => Promise<Tile | null>;

export type LayerIndexParams = {
  context: VTStageContext;
  bandMaxZoom: number;
  geojsonVt: (
    collection: FeatureCollectionLike,
    options: {
      maxZoom: number;
      indexMaxZoom: number;
      extent: number;
      buffer: number;
      tolerance: number;
      promoteId: string;
      indexMaxPoints: number;
    },
  ) => { getTile: (z: number, x: number, y: number) => Tile | null };
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: {
    enabled: boolean;
    toleranceK: number;
    retryToleranceStep: number;
    quantize?: number;
  } | null;
  debugCollect: boolean;
};

export const createLayerIndexForTile = (params: LayerIndexParams): GeojsonVtIndexFactory => {
  const {
    context,
    bandMaxZoom,
    geojsonVt,
    useTopojsonTileSimplify,
    topojsonSimplify,
    debugCollect,
  } = params;

  return async (layerName, features, z, x, y) => buildTileLayerIndexFromFeatures({
    layerName,
    features,
    z,
    x,
    y,
    bandMaxZoom,
    context,
    geojsonVt,
    topojsonSimplify: useTopojsonTileSimplify && topojsonSimplify
      ? {
        enabled: true,
        toleranceK: topojsonSimplify.toleranceK,
        retryToleranceStep: topojsonSimplify.retryToleranceStep,
        quantize: topojsonSimplify.quantize,
      }
      : undefined,
    debugCollect,
  });
};
