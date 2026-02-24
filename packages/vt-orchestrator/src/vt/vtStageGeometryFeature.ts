import type { Feature, Geometry, LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon } from 'geojson';
import type { TileBBox } from './vtStageGeometryTypes.js';

type NumberIndexable = ArrayBufferView & ArrayLike<number>;

const hasCoordinates = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') return true;
  return coords.some((entry) => hasCoordinates(entry));
};

export const isEmptyGeometry = (geometry: Geometry | null | undefined): boolean => {
  if (!geometry) return true;
  if (geometry.type === 'GeometryCollection') {
    return !geometry.geometries.some((child) => !isEmptyGeometry(child));
  }
  return !hasCoordinates((geometry as Geometry & { coordinates?: unknown }).coordinates);
};

export const isClipGeometry = (
  geometry: Geometry,
): geometry is LineString | MultiLineString | Polygon | MultiPolygon => (
  geometry.type === 'LineString'
  || geometry.type === 'MultiLineString'
  || geometry.type === 'Polygon'
  || geometry.type === 'MultiPolygon'
);

export const isPointGeometry = (geometry: Geometry): geometry is Point | MultiPoint => (
  geometry.type === 'Point' || geometry.type === 'MultiPoint'
);

export const isPointInBBox = (x: number, y: number, bbox: TileBBox): boolean => (
  x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
);

export const isAnyPointInBBox = (geometry: Point | MultiPoint, bbox: TileBBox): boolean => {
  if (geometry.type === 'Point') {
    const x = geometry.coordinates[0] ?? NaN;
    const y = geometry.coordinates[1] ?? NaN;
    return Number.isFinite(x) && Number.isFinite(y) && isPointInBBox(x, y, bbox);
  }
  return geometry.coordinates.some((point) => {
    const x = point[0] ?? NaN;
    const y = point[1] ?? NaN;
    return Number.isFinite(x) && Number.isFinite(y) && isPointInBBox(x, y, bbox);
  });
};

type BboxVisitContext = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  hasValue: boolean;
};

const isNumericArrayView = (value: unknown): value is NumberIndexable => (
  value instanceof Int8Array
  || value instanceof Uint8Array
  || value instanceof Uint16Array
  || value instanceof Uint32Array
  || value instanceof Int16Array
  || value instanceof Int32Array
  || value instanceof Float32Array
  || value instanceof Float64Array
  || value instanceof Uint8ClampedArray
);

const isNumberArrayView = (value: unknown): value is ArrayBufferView & NumberIndexable => (
  isNumericArrayView(value)
  && value.length > 0
);

const isNumberArrayLike = (value: unknown): value is ArrayLike<number> => (
  Array.isArray(value) && typeof value[0] === 'number'
);

const visitCoordinates = (coordinates: unknown, context: BboxVisitContext): void => {
  if (isNumberArrayView(coordinates)) {
    const coords = coordinates;
    for (let i = 0; i + 1 < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!context.hasValue) {
        context.hasValue = true;
        context.minX = x;
        context.minY = y;
        context.maxX = x;
        context.maxY = y;
      } else {
        context.minX = Math.min(context.minX, x);
        context.minY = Math.min(context.minY, y);
        context.maxX = Math.max(context.maxX, x);
        context.maxY = Math.max(context.maxY, y);
      }
    }
    return;
  }
  if (isNumberArrayLike(coordinates)) {
    const values = coordinates;
    const x = values[0];
    const y = values[1];
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!context.hasValue) {
      context.hasValue = true;
      context.minX = x;
      context.minY = y;
      context.maxX = x;
      context.maxY = y;
    } else {
      context.minX = Math.min(context.minX, x);
      context.minY = Math.min(context.minY, y);
      context.maxX = Math.max(context.maxX, x);
      context.maxY = Math.max(context.maxY, y);
    }
    return;
  }
  if (Array.isArray(coordinates)) {
    coordinates.forEach((value) => visitCoordinates(value, context));
  }
};

export const featureBBox = (feature: Feature): TileBBox | null => {
  const geometry = feature?.geometry ?? null;
  if (!geometry) return null;
  const context: BboxVisitContext = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    hasValue: false,
  };
  const visitGeometry = (target: Feature['geometry']): void => {
    if (!target) return;
    if (target.type === 'GeometryCollection') {
      const geometries = Array.isArray(target.geometries) ? target.geometries : [];
      geometries.forEach((child) => visitGeometry(child));
      return;
    }
    if ('coordinates' in target) {
      visitCoordinates((target as Geometry & { coordinates?: unknown }).coordinates, context);
    }
  };
  visitGeometry(geometry);
  if (!context.hasValue) return null;
  return {
    minX: context.minX,
    minY: context.minY,
    maxX: context.maxX,
    maxY: context.maxY,
  };
};

export type FeatureWithBBox = {
  feature: Feature;
  bbox: TileBBox;
};

export const buildFeaturesWithBBox = (features: Feature[]): FeatureWithBBox[] => (
  features
    .map((feature) => ({ feature, bbox: featureBBox(feature) }))
    .filter((entry): entry is FeatureWithBBox => Boolean(entry.bbox))
);
