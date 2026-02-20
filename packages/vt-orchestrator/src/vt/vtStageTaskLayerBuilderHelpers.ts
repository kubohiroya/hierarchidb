import type { Tile } from 'geojson-vt';
import type { Feature, Geometry } from 'geojson';
import { dedupeTileLines } from './vtStageGeometry.js';
import type { VTStageContext } from '~/contexts';
import {
  buildTileLayerIndexFromFeatures,
  type GeojsonVtIndex,
} from './vtStageTileIndex.js';

type GeojsonVtIndexFactory = (
  layerName: string,
  features: Feature<Geometry>[],
  z: number,
  x: number,
  y: number,
) => Promise<Tile | null>;

export const collectLayerForTile = (
  index: GeojsonVtIndex,
  layerName: string,
  z: number,
  x: number,
  y: number,
  vtConfigBoundaryDedupe: boolean,
): Tile | null => {
  const tile = index.getTile(z, x, y) as Tile | null;
  if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) return null;
  const finalTile = vtConfigBoundaryDedupe && layerName.endsWith('-boundary')
    ? dedupeTileLines(tile)
    : tile;
  if (!Array.isArray(finalTile.features) || finalTile.features.length === 0) return null;
  return finalTile;
};

export const collectLayersForTileFromIndexes = (
  indexes: Map<string, GeojsonVtIndex>,
  z: number,
  x: number,
  y: number,
  vtConfigBoundaryDedupe: boolean,
): Record<string, Tile> | null => {
  const layers: Record<string, Tile> = {};
  for (const [layerName, index] of indexes.entries()) {
    const tile = collectLayerForTile(index, layerName, z, x, y, vtConfigBoundaryDedupe);
    if (!tile) continue;
    layers[layerName] = tile;
  }
  return Object.keys(layers).length > 0 ? layers : null;
};

export const mergeLayerTiles = (
  target: Record<string, Tile>,
  addition: Record<string, Tile>,
): void => {
  Object.entries(addition).forEach(([layerName, tile]) => {
    const existing = target[layerName];
    if (!existing) {
      target[layerName] = tile;
      return;
    }
    const existingFeatures = Array.isArray(existing.features) ? existing.features : [];
    const nextFeatures = Array.isArray(tile.features) ? tile.features : [];
    target[layerName] = {
      ...existing,
      features: [...existingFeatures, ...nextFeatures],
    };
  });
};

type LayerIndexParams = {
  context: VTStageContext;
  geojsonVt: (
    collection: {
      type: 'FeatureCollection';
      features: Feature<Geometry>[];
    },
    options: {
      maxZoom: number;
      indexMaxZoom: number;
      extent: number;
      buffer: number;
      tolerance: number;
      promoteId: string;
      indexMaxPoints: number;
    },
  ) => GeojsonVtIndex;
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
    geojsonVt,
    useTopojsonTileSimplify,
    topojsonSimplify,
    debugCollect,
  } = params;
  return async (layerName, features, z, x, y) => {
    return buildTileLayerIndexFromFeatures({
      layerName,
      features,
      z,
      x,
      y,
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
};
