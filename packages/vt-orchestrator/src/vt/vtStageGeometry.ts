import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import type { Tile } from 'geojson-vt';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';

export type TileBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type InputFeatureStats = {
  bbox: TileBBox;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
  bufferId: string;
  featureId?: string;
  geojsonByteSize?: number;
};

export const VT_PARENT_INPUT_SUMMARY_METADATA_KEY = 'vtParentInputSummary';

export type VtParentInputSummaryMetadata = {
  parentTile: {
    z: number;
    x: number;
    y: number;
  };
  intersectingFeatureCount: number;
  intersectingGeojsonByteSize: number;
};

export const canonicalLineKey = (coords: number[][]): string => {
  const toKey = (points: number[][]): string =>
    points
      .map((p) => {
        const x = p[0] ?? 0;
        const y = p[1] ?? 0;
        return ((x << 16) ^ y).toString();
      })
      .join(',');
  const a = toKey(coords);
  const b = toKey([...coords].reverse());
  return a < b ? a : b;
};

export const dedupeTileLines = (tile: Tile): Tile => {
  const seen = new Set<string>();
  const out: Tile['features'] = [];

  for (const feature of tile.features) {
    if (feature.type !== 2) {
      out.push(feature);
      continue;
    }
    const newGeom: number[][][] = [];
    const lines = (feature.geometry ?? []) as unknown as number[][][];
    for (const line of lines) {
      const key = canonicalLineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        newGeom.push(line);
      }
    }
    if (newGeom.length > 0) {
      out.push({ ...feature, geometry: newGeom as unknown as Tile['features'][number]['geometry'] });
    }
  }

  return { ...tile, features: out };
};

const toDeg = (r: number): number => r * 180 / Math.PI;

export const tileToBBox = (z: number, x: number, y: number): TileBBox => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

export const bboxIntersects = (a: TileBBox, b: TileBBox): boolean => (
  a.minX <= b.maxX
  && a.maxX >= b.minX
  && a.minY <= b.maxY
  && a.maxY >= b.minY
);

export const expandTileBBox = (bbox: TileBBox, buffer: number, extent: number): TileBBox => {
  if (!Number.isFinite(buffer) || buffer <= 0) return bbox;
  if (!Number.isFinite(extent) || extent <= 0) return bbox;
  const lonSpan = bbox.maxX - bbox.minX;
  const latSpan = bbox.maxY - bbox.minY;
  if (!Number.isFinite(lonSpan) || !Number.isFinite(latSpan)) return bbox;
  const factor = buffer / extent;
  const lonMargin = lonSpan * factor;
  const latMargin = latSpan * factor;
  return {
    minX: bbox.minX - lonMargin,
    minY: bbox.minY - latMargin,
    maxX: bbox.maxX + lonMargin,
    maxY: bbox.maxY + latMargin,
  };
};

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

const isNumberArrayLike = (value: unknown): value is ArrayLike<number> => (
  Array.isArray(value) && typeof value[0] === 'number'
);

type NumberIndexable = { length: number; [index: number]: number };

const isNumberArrayView = (value: unknown): value is ArrayBufferView & NumberIndexable => {
  if (!ArrayBuffer.isView(value)) return false;
  if (typeof (value as { length?: unknown }).length !== 'number') return false;
  const view = value as unknown as NumberIndexable;
  return view.length > 0 && typeof view[0] === 'number';
};

export const featureBBox = (feature: Feature): TileBBox | null => {
  const geometry = feature?.geometry ?? null;
  if (!geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (p: unknown): void => {
    if (isNumberArrayView(p)) {
      const coords = p;
      for (let i = 0; i + 1 < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return;
    }
    if (isNumberArrayLike(p)) {
      const coords = p as ArrayLike<number>;
      const x = coords[0];
      const y = coords[1];
      if (typeof x !== 'number' || typeof y !== 'number') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return;
    }
    if (Array.isArray(p)) {
      p.map((child) => visit(child));
    }
  };
  const visitGeometry = (geom: Feature['geometry']): void => {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') {
      const geometries = Array.isArray(geom.geometries) ? geom.geometries : [];
      geometries.map((child) => visitGeometry(child));
      return;
    }
    if ('coordinates' in geom) {
      visit(geom.coordinates as unknown);
    }
  };
  visitGeometry(geometry);
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
};

export const resolveFeatureId = (feature: Feature): string | undefined => {
  const properties = feature.properties as Record<string, unknown> | undefined;
  const metadataFeatureId = properties?.__hdbFeatureId;
  if (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0) {
    return metadataFeatureId;
  }
  if (typeof feature.id === 'string' && feature.id.trim().length > 0) {
    return feature.id;
  }
  if (typeof feature.id === 'number' && Number.isFinite(feature.id)) {
    return String(feature.id);
  }
  return undefined;
};

export const collectUniqueFeatureIds = (features: Feature<Geometry>[]): string[] => {
  const unique = new Set<string>();
  features.forEach((feature) => {
    const featureId = resolveFeatureId(feature);
    if (!featureId) return;
    unique.add(featureId);
  });
  return Array.from(unique);
};

export const normalizeGeojsonByteSize = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.max(0, Math.round(value));
  return normalized;
};

const countVertices = (coords: unknown): number => {
  if (!coords) return 0;
  if (isNumberArrayView(coords)) {
    const view = coords;
    if (view.length < 2) return 0;
    return Math.floor(view.length / 2);
  }
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

export const countVerticesFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  const coords = 'coordinates' in geometry ? geometry.coordinates : undefined;
  return countVertices(coords);
};

export const countPolygonsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

export const countLineStringsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countLineStringsFromGeometry(child), 0);
  }
  if (geometry.type === 'LineString') return 1;
  if (geometry.type === 'MultiLineString') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

export const countTileVertices = (geometry: unknown): number => {
  if (!Array.isArray(geometry)) return 0;
  if (geometry.length === 0) return 0;
  if (typeof geometry[0] === 'number') return 1;
  return geometry.reduce((sum: number, child: unknown) => sum + countTileVertices(child), 0);
};

const normalizeTileRings = (geometry: unknown): number[][][] => {
  if (!Array.isArray(geometry) || geometry.length === 0) return [];
  const first = geometry[0];
  if (!Array.isArray(first)) return [];
  const first0 = first[0];
  if (Array.isArray(first0) && typeof first0[0] === 'number') {
    return geometry as number[][][];
  }
  if (Array.isArray(first0) && Array.isArray(first0[0])) {
    const rings: number[][][] = [];
    (geometry as unknown as number[][][][]).forEach((polygon) => {
      if (!Array.isArray(polygon)) return;
      polygon.forEach((ring) => {
        if (Array.isArray(ring)) rings.push(ring as number[][]);
      });
    });
    return rings;
  }
  return [];
};

const signedRingArea = (ring: number[][]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const pointA = ring[i];
    const pointB = ring[(i + 1) % ring.length];
    if (!pointA || !pointB || pointA.length < 2 || pointB.length < 2) continue;
    const x1 = pointA[0];
    const y1 = pointA[1];
    const x2 = pointB[0];
    const y2 = pointB[1];
    if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
    sum += (x1 * y2) - (x2 * y1);
  }
  return sum / 2;
};

export const countTilePolygons = (geometry: unknown): number => {
  const rings = normalizeTileRings(geometry);
  if (rings.length === 0) return 0;
  const areas = rings.map((ring) => signedRingArea(ring));
  let maxIndex = 0;
  let maxAbs = 0;
  for (let i = 0; i < areas.length; i += 1) {
    const abs = Math.abs(areas[i] ?? 0);
    if (abs > maxAbs) {
      maxAbs = abs;
      maxIndex = i;
    }
  }
  const targetSign = Math.sign(areas[maxIndex] ?? 0) || 1;
  return areas.reduce((count, area) => (Math.sign(area) === targetSign ? count + 1 : count), 0);
};

export const countTileLineStrings = (geometry: unknown): number => {
  if (!Array.isArray(geometry)) return 0;
  if (geometry.length === 0) return 0;
  const first = geometry[0];
  if (Array.isArray(first) && typeof first[0] === 'number') return 1;
  return geometry.length;
};

export const buildBufferSetHash = (bufferIds: string[]): string => {
  const sorted = [...bufferIds].sort();
  const json = JSON.stringify(sorted);
  const encoder = new TextEncoder();
  const port = new NobleSha3HashPort();
  return port.digest(encoder.encode(json).buffer, 'sha3-256');
};

export const buildLayerMap = (collection: FeatureCollection): Map<string, Feature[]> => {
  const map = new Map<string, Feature[]>();
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties ?? {};
    const layer = typeof props.layer === 'string' ? props.layer : 'admin0';
    const bucket = map.get(layer);
    if (bucket) {
      bucket.push(feature);
    } else {
      map.set(layer, [feature]);
    }
  }
  return map;
};

export const resolveMaxVerticesPerTile = (indexMaxPoints: number): number => (
  Number.isFinite(indexMaxPoints) && indexMaxPoints > 0 ? indexMaxPoints : 65536
);
