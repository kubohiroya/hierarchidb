import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryOps } from './core.js';
import { latToTileY, lonToTileX } from '@hierarchidb/gis-sdk';
import { packTileId } from '~/tiles/tileId';
import type { GeojsonValidationIssue } from './validation.js';
import { countVerticesFromGeometry, validateGeometryForVt } from './validation.js';

export type BoundaryLayerSummary = {
  featureCount: number;
  vertexCount: number;
  maxVertexCount: number;
  geometryTypes: Record<string, number>;
};

export type BoundaryDiagnostics = {
  totalFeatures: number;
  totalVertices: number;
  maxVertices: number;
  layers: Record<string, BoundaryLayerSummary>;
};

export const buildBoundaryDiagnostics = (collection: FeatureCollection): BoundaryDiagnostics | null => {
  const layers: Record<string, BoundaryLayerSummary> = {};
  let totalFeatures = 0;
  let totalVertices = 0;
  let maxVertices = 0;
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties as Record<string, unknown> | undefined;
    const layer = typeof props?.layer === 'string' ? props.layer : 'unknown';
    if (!layer.endsWith('-boundary')) continue;
    const geometryType = feature.geometry?.type ?? 'unknown';
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    totalFeatures += 1;
    totalVertices += vertexCount;
    maxVertices = Math.max(maxVertices, vertexCount);
    const summary = layers[layer] ?? {
      featureCount: 0,
      vertexCount: 0,
      maxVertexCount: 0,
      geometryTypes: {},
    };
    summary.featureCount += 1;
    summary.vertexCount += vertexCount;
    summary.maxVertexCount = Math.max(summary.maxVertexCount, vertexCount);
    summary.geometryTypes[geometryType] = (summary.geometryTypes[geometryType] ?? 0) + 1;
    layers[layer] = summary;
  }
  if (totalFeatures === 0) return null;
  return {
    totalFeatures,
    totalVertices,
    maxVertices,
    layers,
  };
};

export const validateOutputForVt = (collection: FeatureCollection): GeojsonValidationIssue[] => {
  const issues: GeojsonValidationIssue[] = [];
  for (let index = 0; index < collection.features.length; index += 1) {
    const feature = collection.features[index];
    if (!feature) continue;
    const props = feature.properties as Record<string, unknown> | undefined;
    const layer = typeof props?.layer === 'string' ? props.layer : 'unknown';
    const featureId = String(feature.id ?? props?.id ?? props?.boundaryID ?? props?.boundaryISO ?? `${layer}:${index}`);
    const reason = validateGeometryForVt(feature.geometry ?? null);
    if (!reason) continue;
    const geometryType = feature.geometry?.type ?? 'unknown';
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    let sampleCoords: number[][] | undefined;
    if (feature.geometry?.type === 'LineString') {
      sampleCoords = (feature.geometry.coordinates ?? []).slice(0, 3) as number[][];
    } else if (feature.geometry?.type === 'Polygon') {
      sampleCoords = (feature.geometry.coordinates?.[0] ?? []).slice(0, 3) as number[][];
    } else if (feature.geometry?.type === 'MultiPolygon') {
      sampleCoords = (feature.geometry.coordinates?.[0]?.[0] ?? []).slice(0, 3) as number[][];
    }
    issues.push({
      layer,
      featureId,
      geometryType,
      vertexCount,
      reason,
      ...(sampleCoords ? { sampleCoords } : {}),
    });
  }
  return issues;
};

export const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);

export const toDeg = (radians: number): number => radians * 180 / Math.PI;

export const tileToBBox = (z: number, x: number, y: number): { minX: number; minY: number; maxX: number; maxY: number } => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

export const isPointInBBox = (x: number, y: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => (
  x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
);

export const isAnyPointInBBox = (geometry: Feature['geometry'], bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
  if (!geometry) return false;
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates ?? [];
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    return isPointInBBox(x, y, bbox);
  }
  if (geometry.type === 'MultiPoint') {
    for (const point of geometry.coordinates) {
      const [x, y] = point ?? [];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (isPointInBBox(x, y, bbox)) return true;
    }
    return false;
  }
  return false;
};

export const hasCoordinates = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') return true;
  return coords.some((entry) => hasCoordinates(entry));
};

export const hasCoordinatesFromGeometry = (geometry: Geometry): boolean => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.some((child) => hasCoordinatesFromGeometry(child));
  }
  return hasCoordinates((geometry as Geometry & { coordinates: unknown }).coordinates);
};

export const isLineOrPolygonFeature = (
  feature: Feature<Geometry>,
): feature is Feature<LineString | MultiLineString | Polygon | MultiPolygon> => {
  const type = feature.geometry?.type;
  return type === 'LineString'
    || type === 'MultiLineString'
    || type === 'Polygon'
    || type === 'MultiPolygon';
};

export const featureIntersectsTileBBox = (
  feature: Feature<Geometry>,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  geometryOps: GeometryOps,
): boolean => {
  if (isAnyPointInBBox(feature.geometry ?? null, bbox)) return true;
  if (!isLineOrPolygonFeature(feature)) return false;
  return geometryOps.intersectsBBox(feature, bbox);
};

export const collectTileIdsForCollection = (
  collection: FeatureCollection,
  zBase: number,
  geometryOps: GeometryOps,
): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const bbox = geometryOps.bbox(feature as Feature<Geometry>);
    if (!bbox) continue;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) continue;
    const x1Raw = lonToTileX(minLon, zBase);
    const x2Raw = lonToTileX(maxLon, zBase);
    const y1Raw = latToTileY(maxLat, zBase);
    const y2Raw = latToTileY(minLat, zBase);
    if (![x1Raw, x2Raw, y1Raw, y2Raw].every((value) => Number.isFinite(value))) continue;
    const x1 = clampTileIndex(x1Raw as number, maxIndex);
    const x2 = clampTileIndex(x2Raw as number, maxIndex);
    const y1 = clampTileIndex(y1Raw as number, maxIndex);
    const y2 = clampTileIndex(y2Raw as number, maxIndex);
    for (let x = x1; x <= x2; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
        const tileBBox = tileToBBox(zBase, x, y);
        if (!featureIntersectsTileBBox(feature as Feature<Geometry>, tileBBox, geometryOps)) continue;
        tileIds.add(packTileId(x, y, zBase));
      }
    }
  }
  return [...tileIds];
};
