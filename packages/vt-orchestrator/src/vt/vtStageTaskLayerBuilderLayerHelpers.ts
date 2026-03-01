import type { Tile } from 'geojson-vt';
import type { Feature, Geometry } from 'geojson';
import { parseShapeSourceLayerName } from '@hierarchidb/gis-sdk';
import { dedupeTileLines } from './vtStageTileLineUtils.js';
import { type GeojsonVtIndex } from './vtStageTileIndex.js';

const isBoundaryLayerName = (value: string): boolean => {
  const parsed = parseShapeSourceLayerName(value);
  return parsed?.boundary === 'b';
};

export const collectLayerForTile = (
  index: GeojsonVtIndex,
  layerName: string,
  z: number,
  x: number,
  y: number,
  tileEmitConfigBoundaryDedupe: boolean,
): Tile | null => {
  const tile = index.getTile(z, x, y) as Tile | null;
  if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) return null;
  const finalTile = tileEmitConfigBoundaryDedupe && isBoundaryLayerName(layerName)
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
  tileEmitConfigBoundaryDedupe: boolean,
): Record<string, Tile> | null => {
  const layers: Record<string, Tile> = {};
  for (const [layerName, index] of indexes.entries()) {
    const tile = collectLayerForTile(index, layerName, z, x, y, tileEmitConfigBoundaryDedupe);
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

export type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: Feature<Geometry>[];
};
