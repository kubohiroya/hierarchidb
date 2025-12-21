import type { FeatureFilterMethod } from '../../../common/types/processing.js';
import type { HybridFilterConfig } from '../../../common/types/BatchConfig.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../../common/types/constants.js';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface FeatureFilterSettings {
  minArea: number;
  featureFilterMethod?: FeatureFilterMethod;
  minVertexCountForAreaFilter?: number;
  hybridFilterConfig?: HybridFilterConfig;
}

const defaultHybridConfig = DEFAULT_PROCESSING_CONFIG.simplificationConfig?.hybridFilterConfig;

const countVertices = (geometry: Geometry | null | undefined): number => {
  if (!geometry) return 0;
  switch (geometry.type) {
    case 'Point':
      return 1;
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates.length;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.reduce((sum, ring) => sum + ring.length, 0);
    case 'MultiPolygon':
      return geometry.coordinates.reduce(
        (sum, poly) => sum + poly.reduce((inner, ring) => inner + ring.length, 0),
        0,
      );
    case 'GeometryCollection':
      return geometry.geometries.reduce((sum, g) => sum + countVertices(g), 0);
    default:
      return 0;
  }
};

const computeBboxAreaSqKm = (geometry: Geometry): number => {
  const bbox = turf.bbox(geometry);
  const polygon = turf.bboxPolygon(bbox);
  return turf.area(polygon) / 1_000_000;
};

const computePolygonAreaSqKm = (geometry: Geometry): number => turf.area(geometry) / 1_000_000;

const computeAspectRatio = (geometry: Geometry): number => {
  const [minX, minY, maxX, maxY] = turf.bbox(geometry);
  const width = Math.abs(maxX - minX);
  const height = Math.abs(maxY - minY);
  if (width === 0 || height === 0) return Number.POSITIVE_INFINITY;
  return width > height ? width / height : height / width;
};

const passesAreaThreshold = (geometry: Geometry, settings: FeatureFilterSettings): boolean => {
  const threshold = settings.minArea;
  if (!Number.isFinite(threshold) || threshold <= 0) return true;

  const method = settings.featureFilterMethod ?? 'hybrid';
  const minVertexCount = settings.minVertexCountForAreaFilter ?? 0;
  const hybridConfig = settings.hybridFilterConfig ?? defaultHybridConfig;

  if (method === 'bbox_only') {
    return computeBboxAreaSqKm(geometry) >= threshold;
  }

  if (method === 'polygon_only') {
    return computePolygonAreaSqKm(geometry) >= threshold;
  }

  const bboxArea = computeBboxAreaSqKm(geometry);
  if (hybridConfig?.quickRejectThreshold && bboxArea < threshold * hybridConfig.quickRejectThreshold) {
    return false;
  }

  const vertexCount = countVertices(geometry);
  const polygonArea = computePolygonAreaSqKm(geometry);
  const aspectRatio = computeAspectRatio(geometry);
  const ratio = bboxArea > 0 ? polygonArea / bboxArea : 0;
  const correction = hybridConfig?.elongatedShapeCorrectionFactor ?? 1;

  if (minVertexCount > 0 && vertexCount < minVertexCount) {
    return bboxArea >= threshold;
  }

  return polygonArea >= threshold;
};

export const applyFeatureFiltering = (geojson: unknown, settings: FeatureFilterSettings): unknown => {
  if (!geojson || typeof geojson !== 'object') return geojson;
  const collection = geojson as FeatureCollection;
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return geojson;
  }
  const filtered = collection.features.filter((feature: Feature) => {
    if (!feature?.geometry) return false;
    return passesAreaThreshold(feature.geometry, settings);
  });
  return {
    ...collection,
    features: filtered,
  } satisfies FeatureCollection;
};
