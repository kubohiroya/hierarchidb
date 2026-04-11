import type { Tile } from 'geojson-vt';
import type { InputFeatureStats, TileBBox } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import {
  bboxIntersects,
} from './vtStageGeometryTileUtils.js';
import {
  countTileLineStrings,
  countTilePolygons,
  countTileVertices,
} from './vtStageGeometryCountsUtils.js';
import type { GeojsonVtIndex } from './buildTileLayerIndexFromFeatures.js';

type TileLayerMap = Record<string, Tile>;

export type VtInputTileStats = {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
  inputBytes: number;
};

export type VtOutputTileStats = {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
};

export const collectLayersForTileFromIndexes = (
  indexes: Map<string, GeojsonVtIndex>,
  z: number,
  x: number,
  y: number,
): TileLayerMap | null => {
  const layers: TileLayerMap = {};
  for (const [layerName, index] of indexes.entries()) {
    const tile = index.getTile(z, x, y) as Tile | null;
    if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) {
      continue;
    }
    layers[layerName] = tile;
  }
  return Object.keys(layers).length > 0 ? layers : null;
};

export const calculateInputTileStats = (
  featureStats: InputFeatureStats[],
  bufferSizes: Map<string, number>,
  bbox: TileBBox,
): VtInputTileStats => {
  let featureCount = 0;
  let vertexCount = 0;
  let polygonCount = 0;
  let lineStringCount = 0;
  const bufferSet = new Set<string>();
  for (const stats of featureStats) {
    if (!bboxIntersects(stats.bbox, bbox)) continue;
    featureCount += 1;
    vertexCount += stats.vertexCount;
    polygonCount += stats.polygonCount;
    lineStringCount += stats.lineStringCount;
    bufferSet.add(stats.bufferId);
  }
  let inputBytes = 0;
  bufferSet.forEach((bufferId) => {
    inputBytes += bufferSizes.get(bufferId) ?? 0;
  });
  return { featureCount, vertexCount, polygonCount, lineStringCount, inputBytes };
};

export const calculateOutputTileStats = (layers: TileLayerMap): VtOutputTileStats => {
  let featureCount = 0;
  let vertexCount = 0;
  let polygonCount = 0;
  let lineStringCount = 0;
  Object.values(layers).forEach((tile) => {
    const features = Array.isArray(tile.features) ? tile.features : [];
    featureCount += features.length;
    features.forEach((feature) => {
      if (feature.type === 3) {
        polygonCount += countTilePolygons(feature.geometry);
        vertexCount += countTileVertices(feature.geometry);
      } else if (feature.type === 2) {
        lineStringCount += countTileLineStrings(feature.geometry);
        vertexCount += countTileVertices(feature.geometry);
      } else {
        vertexCount += countTileVertices(feature.geometry);
      }
    });
  });
  return { featureCount, vertexCount, polygonCount, lineStringCount };
};
