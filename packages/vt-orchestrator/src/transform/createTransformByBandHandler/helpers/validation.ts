import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import type { GeometryEngine, GeometrySimplifyAlgorithm } from '@hierarchidb/gis-sdk';
import { geometryUnkinkPolygons } from '@hierarchidb/gis-sdk';
import {
  decodeSourceCache,
  decodeTopoJsonSourceCache,
  type GeometryOps,
  resolveSimplifyAlgorithm,
} from './core.js';

export const decodeSourceCacheByFormat = async (params: {
  buffer: ArrayBuffer;
  format?: string;
  compression?: string;
  zTarget: number;
  toleranceK: number;
  quantize?: number;
  simplifyAlgorithm?: GeometrySimplifyAlgorithm;
  skipSimplification?: boolean;
}): Promise<FeatureCollection | null> => {
  if (params.format === 'topojson') {
    return decodeTopoJsonSourceCache({
      buffer: params.buffer,
      compression: params.compression,
      zTarget: params.zTarget,
      toleranceK: params.toleranceK,
      quantize: params.quantize,
      simplifyAlgorithm: resolveSimplifyAlgorithm(params.simplifyAlgorithm),
      skipSimplification: params.skipSimplification,
    });
  }
  return decodeSourceCache(params.buffer);
};

export const simplifyOnlyCollection = (
  collection: FeatureCollection,
  zTarget: number,
  toleranceK: number,
  geometryOps: GeometryOps,
  _options?: { skipLargeArea?: boolean },
): FeatureCollection => geometryOps.simplifyCollection(collection, zTarget, toleranceK);

export type GeojsonValidationIssue = {
  layer: string;
  featureId: string;
  geometryType: string;
  vertexCount: number;
  reason: string;
  sampleCoords?: number[][];
};

export const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const isValidPosition = (value: unknown): value is number[] => (
  Array.isArray(value)
  && value.length >= 2
  && isFiniteNumber(value[0])
  && isFiniteNumber(value[1])
);

export const isClosedRing = (ring: number[][]): boolean => {
  if (ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return Boolean(first && last && first[0] === last[0] && first[1] === last[1]);
};

export const validateLineStringCoords = (coords: unknown): number[][] | null => {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const points = coords.filter((p) => isValidPosition(p)) as number[][];
  return points.length === coords.length ? points : null;
};

export const validatePolygonCoords = (coords: unknown): number[][][] | null => {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const rings = coords;
  const out: number[][][] = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const points = ring.filter((p) => isValidPosition(p)) as number[][];
    if (points.length !== ring.length) return null;
    if (!isClosedRing(points)) return null;
    out.push(points);
  }
  return out;
};

export const validateGeometryForVt = (geometry: Geometry | null | undefined): string | null => {
  if (!geometry) return 'missing geometry';
  switch (geometry.type) {
    case 'Point':
      return isValidPosition(geometry.coordinates) ? null : 'invalid point coordinates';
    case 'MultiPoint':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((coord) => isValidPosition(coord))
        ? null
        : 'invalid multipoint coordinates';
    case 'LineString':
      return validateLineStringCoords(geometry.coordinates) ? null : 'invalid linestring coordinates';
    case 'MultiLineString':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((line) => validateLineStringCoords(line))
        ? null
        : 'invalid multilinestring coordinates';
    case 'Polygon':
      return validatePolygonCoords(geometry.coordinates) ? null : 'invalid polygon coordinates';
    case 'MultiPolygon':
      return Array.isArray(geometry.coordinates)
        && geometry.coordinates.every((poly) => validatePolygonCoords(poly))
        ? null
        : 'invalid multipolygon coordinates';
    case 'GeometryCollection':
      return geometry.geometries.every((geom) => !validateGeometryForVt(geom))
        ? null
        : 'invalid geometry collection';
    default:
      return 'unknown geometry type';
  }
};

export const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

export const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

export const maxVerticesInCollection = (collection: FeatureCollection): number => {
  let maxVertices = 0;
  for (const feature of collection.features) {
    const vertexCount = countVerticesFromGeometry(feature.geometry);
    if (vertexCount > maxVertices) {
      maxVertices = vertexCount;
    }
  }
  return maxVertices;
};

export const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum: number, child: Geometry) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

export const repairCollectionSelfIntersections = (
  collection: FeatureCollection,
  geometryOps: GeometryOps,
  engine: GeometryEngine,
): { collection: FeatureCollection; repairedFeatureCount: number } => {
  let repairedFeatureCount = 0;
  const repairedFeatures = collection.features.map((feature) => {
    const geometry = feature?.geometry;
    if (!geometry) return feature;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      return feature;
    }
    if (geometryOps.isValid(geometry)) return feature;
    try {
      const polygons = geometryUnkinkPolygons(feature as Feature<Polygon | MultiPolygon>, engine);
      if (!Array.isArray(polygons) || polygons.length === 0) {
        return feature;
      }
      const singlePolygon = polygons.length === 1 ? polygons[0] : null;
      if (polygons.length === 1 && !singlePolygon) {
        return feature;
      }
      const repairedGeometry: Polygon | MultiPolygon = singlePolygon
        ? singlePolygon
        : { type: 'MultiPolygon', coordinates: polygons.map((polygon) => polygon.coordinates) };
      if (!geometryOps.isValid(repairedGeometry)) {
        return feature;
      }
      repairedFeatureCount += 1;
      return {
        ...feature,
        geometry: repairedGeometry,
      };
    } catch {
      return feature;
    }
  });
  if (repairedFeatureCount === 0) {
    return { collection, repairedFeatureCount };
  }
  return {
    collection: {
      ...collection,
      features: repairedFeatures,
    },
    repairedFeatureCount,
  };
};
