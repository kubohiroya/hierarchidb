import type { Tile } from 'geojson-vt';
import type { Feature, FeatureCollection } from 'geojson';
import {
  type InputFeatureStats,
  type TileBBox,
  type VtParentInputSummaryMetadata,
} from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import { parseShapeSourceLayerName } from '@hierarchidb/gis-sdk';
import { bboxIntersects } from './vtStageGeometryTileUtils.js';
import {
  countTileLineStrings,
  countTilePolygons,
  countTileVertices,
} from './vtStageGeometryCountsUtils.js';

export type GeojsonVtEmptyTileDetail = {
  z: number;
  x: number;
  y: number;
  layerName: string;
  clippedFeatureCount: number;
  featureCount: number;
  matchedFeatureIds?: string[];
};

const resolveAdminLevel = (feature: Feature): number | null => {
  const props = feature.properties as Record<string, unknown> | undefined;
  const layer = parseShapeSourceLayerName(props?.layer);
  if (layer) {
    return layer.boundary === 'f' ? layer.adminLevel : null;
  }
  const level = typeof props?.level === 'number' ? props.level : null;
  if (typeof level === 'number' && Number.isFinite(level)) return level;
  return null;
};

export const buildAdminFeatureSummary = (collection: FeatureCollection): string => {
  const counts = new Map<number, number>();
  collection.features.forEach((feature) => {
    if (!feature) return;
    const level = resolveAdminLevel(feature);
    if (level === null || Number.isNaN(level)) return;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  });
  if (counts.size === 0) return 'features: none';
  const parts = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `ADM${level}:${formatCount(count)}`);
  return `features: ${parts.join(' / ')}`;
};

export const buildVtParentInputSummary = (params: {
  featureStats: InputFeatureStats[];
  parentBBox: TileBBox;
  parentTile: { z: number; x: number; y: number };
}): VtParentInputSummaryMetadata => {
  let intersectingFeatureCount = 0;
  let intersectingGeojsonByteSize = 0;
  const intersectingAreaByCountry = new Map<string, number>();
  params.featureStats.forEach((stats) => {
    if (!bboxIntersects(stats.bbox, params.parentBBox)) return;
    intersectingFeatureCount += 1;
    intersectingGeojsonByteSize += stats.geojsonByteSize ?? 0;
    const countryCode = typeof stats.countryCode === 'string' ? stats.countryCode.trim().toUpperCase() : '';
    const area = typeof stats.featureAreaSqMeters === 'number' && Number.isFinite(stats.featureAreaSqMeters)
      ? Math.max(0, stats.featureAreaSqMeters)
      : 0;
    if (!countryCode || area <= 0) return;
    intersectingAreaByCountry.set(countryCode, (intersectingAreaByCountry.get(countryCode) ?? 0) + area);
  });
  const topCountriesByIntersectingArea = Array.from(intersectingAreaByCountry.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([countryCode, intersectingAreaSqMeters]) => ({
      countryCode,
      intersectingAreaSqMeters,
    }));
  return {
    parentTile: params.parentTile,
    intersectingFeatureCount,
    intersectingGeojsonByteSize,
    topCountriesByIntersectingArea,
  };
};

const formatCount = (value: number): string => value.toLocaleString('en-US');

export const buildTileSummary = (tilesByZoom: Map<number, { total: number; generated: number }>): string => {
  if (tilesByZoom.size === 0) return 'tiles -> 0/0';
  const parts = Array.from(tilesByZoom.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, counts]) => `${formatCount(counts.generated)}/${formatCount(counts.total)}`);
  return `tiles -> ${parts.join(', ')}`;
};

export const buildSkippedMessage = (featureSummary: string, tileSummary: string, reason: string): string => (
  `${featureSummary}, ${tileSummary} (skipped: ${reason})`
);

export const buildGeojsonVtEmptyTileReason = (detail: GeojsonVtEmptyTileDetail): string => ([
  'geojson-vt produced empty tile for clipped features',
  `tile=${detail.z}/${detail.x}/${detail.y}`,
  `layer=${detail.layerName}`,
  `clippedFeatures=${detail.clippedFeatureCount}`,
  `layerFeatures=${detail.featureCount}`,
].join(', '));

export const buildGeojsonVtEmptyTileSummaryReason = (
  emptyCount: number,
  firstDetail: GeojsonVtEmptyTileDetail,
): string => (
  emptyCount <= 1
    ? buildGeojsonVtEmptyTileReason(firstDetail)
    : `${buildGeojsonVtEmptyTileReason(firstDetail)}, emptyTileCount=${formatCount(emptyCount)}`
);

export const computeOutputTileTotals = (tiles: Tile[]): {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
} => {
  const totals = {
    featureCount: 0,
    vertexCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
  };
  return tiles.reduce((acc, tile) => {
    const features = Array.isArray(tile.features) ? tile.features : [];
    acc.featureCount += features.length;
    features.forEach((feature) => {
      if (feature.type === 3) {
        acc.polygonCount += countTilePolygons(feature.geometry);
        acc.vertexCount += countTileVertices(feature.geometry);
      } else if (feature.type === 2) {
        acc.lineStringCount += countTileLineStrings(feature.geometry);
        acc.vertexCount += countTileVertices(feature.geometry);
      } else {
        acc.vertexCount += countTileVertices(feature.geometry);
      }
    });
    return acc;
  }, totals);
};
