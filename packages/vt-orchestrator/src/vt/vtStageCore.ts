import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Geometry,
  Polygon,
} from 'geojson';
import { geometryBboxClip } from '@hierarchidb/gis-sdk';
import { parentToChildRange } from '~/tiles/tileId';
import type { BandConfig } from '~/types/types';
import {
  type InputFeatureStats,
  type TileBBox,
  type VtParentInputSummaryMetadata,
  bboxIntersects,
  featureBBox,
  isAnyPointInBBox,
  isEmptyGeometry,
  isPointGeometry,
  isClipGeometry,
} from './vtStageGeometry.js';

export const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

export const formatCount = (value: number): string => value.toLocaleString('en-US');

export const resolveAdminLevel = (feature: Feature): number | null => {
  const props = feature.properties as Record<string, unknown> | undefined;
  const layer = typeof props?.layer === 'string' ? props.layer : '';
  if (layer.endsWith('-boundary')) return null;
  const level = typeof props?.level === 'number' ? props.level : null;
  if (typeof level === 'number' && Number.isFinite(level)) return level;
  const match = layer.match(/^admin(\d+)/);
  return match ? Number(match[1]) : null;
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

export const getHeapSnapshot = (): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null => {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } })
    .memory;
  return memory ? {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  } : null;
};

export const buildTilesByZoom = (
  band: BandConfig,
  parent: { z: number; x: number; y: number }
): Map<number, { total: number; generated: number }> => {
  const tilesByZoom = new Map<number, { total: number; generated: number }>();
  for (let z = band.zMin; z <= band.zMax; z++) {
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    const total = Math.max(0, xEnd - xStart + 1) * Math.max(0, yEnd - yStart + 1);
    tilesByZoom.set(z, { total, generated: 0 });
  }
  return tilesByZoom;
};

export const buildVtParentInputSummary = (params: {
  featureStats: InputFeatureStats[];
  parentBBox: TileBBox;
  parentTile: { z: number; x: number; y: number };
}): VtParentInputSummaryMetadata => {
  let intersectingFeatureCount = 0;
  let intersectingGeojsonByteSize = 0;
  params.featureStats.forEach((stats) => {
    if (!bboxIntersects(stats.bbox, params.parentBBox)) return;
    intersectingFeatureCount += 1;
    intersectingGeojsonByteSize += stats.geojsonByteSize ?? 0;
  });
  return {
    parentTile: params.parentTile,
    intersectingFeatureCount,
    intersectingGeojsonByteSize,
  };
};

export type FeatureWithBBox = { feature: Feature; bbox: TileBBox };

export const buildFeaturesWithBBox = (features: Feature[]): FeatureWithBBox[] => (
  features
    .map((feature) => ({ feature, bbox: featureBBox(feature) }))
    .filter((entry): entry is FeatureWithBBox => Boolean(entry.bbox))
);

export const clipFeaturesForTile = (
  featuresWithBBox: FeatureWithBBox[],
  tileBBox: TileBBox,
): Feature<Geometry>[] => {
  const clippedFeatures: Feature<Geometry>[] = [];
  for (const entry of featuresWithBBox) {
    if (!bboxIntersects(entry.bbox, tileBBox)) continue;
    const sourceFeature = entry.feature;
    const geometry = sourceFeature.geometry;
    let clipped: Feature<Geometry> | null = null;
    if (geometry && isClipGeometry(geometry)) {
      const clipFeature = sourceFeature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>;
      clipped = geometryBboxClip(
        clipFeature,
        [tileBBox.minX, tileBBox.minY, tileBBox.maxX, tileBBox.maxY],
        'turf',
      ) as Feature<Geometry>;
    } else if (geometry && isPointGeometry(geometry)) {
      if (isAnyPointInBBox(geometry, tileBBox)) {
        clipped = sourceFeature as Feature<Geometry>;
      }
    }
    if (!clipped || isEmptyGeometry(clipped.geometry)) continue;
    clippedFeatures.push(clipped);
  }
  return clippedFeatures;
};
