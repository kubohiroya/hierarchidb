import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import {
  geometryArea,
  type FetchInvalidGeometryFilterConfig,
  type GeometryEngine,
  type OmitDetailsConfig,
} from '@hierarchidb/gis-sdk';

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;
const MAX_MERCATOR_LAT = 85.05112878;

type LonLat = [number, number];
type Mercator = [number, number];

type OmitDetailsThreshold = {
  maxZoom: number;
  minBBoxPx: number;
  minAreaPx2: number;
};

type InvalidGeometryCheckName = 'area' | 'line length' | 'max edge length' | 'self intersection' | 'triangle ring ratio';

type InvalidGeometryCheckProgress = {
  check: InvalidGeometryCheckName;
  polygonIndex: number;
  polygonTotal: number;
};

const INVALID_FILTER_THRESHOLDS = {
  minAreaMeters2: 1e-8,
  minLineLengthMeters: 1e-6,
  maxEdgeToBBoxDiagonalRatio: 8,
  minTriangleAreaToBBoxRatio: 0.015,
} as const;

const OMIT_DETAILS_PRESETS: Record<OmitDetailsConfig['level'], OmitDetailsThreshold[]> = {
  weak: [
    { maxZoom: 3, minBBoxPx: 1, minAreaPx2: 2 },
    { maxZoom: 6, minBBoxPx: 0.5, minAreaPx2: 0.5 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.25, minAreaPx2: 0.1 },
  ],
  medium: [
    { maxZoom: 3, minBBoxPx: 1.5, minAreaPx2: 3 },
    { maxZoom: 6, minBBoxPx: 0.75, minAreaPx2: 0.75 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.4, minAreaPx2: 0.2 },
  ],
  strong: [
    { maxZoom: 3, minBBoxPx: 2, minAreaPx2: 4 },
    { maxZoom: 6, minBBoxPx: 1, minAreaPx2: 1 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.5, minAreaPx2: 0.25 },
  ],
};

const metersPerPixel = (z: number): number => (
  (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z))
);

const lonLatToMercator = ([lon, lat]: LonLat): Mercator => {
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return [x, y];
};

const computeRingLengthMeters = (ring: number[][]): number => {
  if (ring.length < 2) return 0;
  let length = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const prev = ring[index - 1];
    const curr = ring[index];
    if (!prev || !curr) continue;
    const [prevX, prevY] = lonLatToMercator([prev[0] ?? 0, prev[1] ?? 0]);
    const [currX, currY] = lonLatToMercator([curr[0] ?? 0, curr[1] ?? 0]);
    const dx = currX - prevX;
    const dy = currY - prevY;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    const [firstX, firstY] = lonLatToMercator([first[0] ?? 0, first[1] ?? 0]);
    const [lastX, lastY] = lonLatToMercator([last[0] ?? 0, last[1] ?? 0]);
    const dx = lastX - firstX;
    const dy = lastY - firstY;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
};

const isSameLonLat = (a: number[] | undefined, b: number[] | undefined): boolean => (
  Boolean(a)
  && Boolean(b)
  && (a?.[0] ?? NaN) === (b?.[0] ?? NaN)
  && (a?.[1] ?? NaN) === (b?.[1] ?? NaN)
);

const stripClosedRingTail = (ring: number[][]): number[][] => {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return isSameLonLat(first, last) ? ring.slice(0, -1) : ring;
};

const toMercatorRing = (ring: number[][]): Mercator[] => (
  stripClosedRingTail(ring).map((point) => lonLatToMercator([point[0] ?? 0, point[1] ?? 0]))
);

const computeRingMaxEdgeLengthMeters = (ring: number[][]): number => {
  if (ring.length < 2) return 0;
  let maxEdgeLength = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const prev = ring[index - 1];
    const curr = ring[index];
    if (!prev || !curr) continue;
    const [prevX, prevY] = lonLatToMercator([prev[0] ?? 0, prev[1] ?? 0]);
    const [currX, currY] = lonLatToMercator([curr[0] ?? 0, curr[1] ?? 0]);
    const edgeLength = Math.hypot(currX - prevX, currY - prevY);
    if (edgeLength > maxEdgeLength) maxEdgeLength = edgeLength;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last) {
    const [firstX, firstY] = lonLatToMercator([first[0] ?? 0, first[1] ?? 0]);
    const [lastX, lastY] = lonLatToMercator([last[0] ?? 0, last[1] ?? 0]);
    const closingEdge = Math.hypot(lastX - firstX, lastY - firstY);
    if (closingEdge > maxEdgeLength) maxEdgeLength = closingEdge;
  }
  return maxEdgeLength;
};

const orientation = (a: Mercator, b: Mercator, c: Mercator): number => (
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
);

const onSegment = (a: Mercator, b: Mercator, c: Mercator): boolean => (
  Math.min(a[0], c[0]) <= b[0]
  && b[0] <= Math.max(a[0], c[0])
  && Math.min(a[1], c[1]) <= b[1]
  && b[1] <= Math.max(a[1], c[1])
);

const segmentsIntersect = (a1: Mercator, a2: Mercator, b1: Mercator, b2: Mercator): boolean => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  const eps = 1e-9;

  if ((o1 > eps && o2 < -eps || o1 < -eps && o2 > eps)
    && (o3 > eps && o4 < -eps || o3 < -eps && o4 > eps)) {
    return true;
  }
  if (Math.abs(o1) <= eps && onSegment(a1, b1, a2)) return true;
  if (Math.abs(o2) <= eps && onSegment(a1, b2, a2)) return true;
  if (Math.abs(o3) <= eps && onSegment(b1, a1, b2)) return true;
  if (Math.abs(o4) <= eps && onSegment(b1, a2, b2)) return true;
  return false;
};

const countRingSelfIntersections = (ring: number[][]): number => {
  const vertices = toMercatorRing(ring);
  if (vertices.length < 4) return 0;
  const edges: Array<[Mercator, Mercator]> = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) continue;
    edges.push([start, end]);
  }
  let intersections = 0;
  for (let i = 0; i < edges.length; i += 1) {
    const edgeA = edges[i];
    if (!edgeA) continue;
    for (let j = i + 1; j < edges.length; j += 1) {
      const edgeB = edges[j];
      if (!edgeB) continue;
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === edges.length - 1) continue;
      if (segmentsIntersect(edgeA[0], edgeA[1], edgeB[0], edgeB[1])) {
        intersections += 1;
      }
    }
  }
  return intersections;
};

const countTriangleVertices = (ring: number[][]): number => stripClosedRingTail(ring).length;

const computePolygonArea = (coords: number[][][], geometryEngine: GeometryEngine): number => {
  try {
    return Math.abs(geometryArea({ type: 'Polygon', coordinates: coords } as Polygon, geometryEngine));
  } catch {
    return 0;
  }
};

const computeOuterRingBounds = (coords: number[][][]): { widthMeters: number; heightMeters: number } => {
  const outer = coords[0];
  if (!outer || outer.length === 0) {
    return { widthMeters: 0, heightMeters: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of outer) {
    if (!point) continue;
    const [lon, lat] = point;
    const [x, y] = lonLatToMercator([lon ?? 0, lat ?? 0]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { widthMeters: 0, heightMeters: 0 };
  }
  return { widthMeters: Math.max(0, maxX - minX), heightMeters: Math.max(0, maxY - minY) };
};

type PolygonGeometryMetrics = {
  areaMeters2: number;
  lineLengthMeters: number;
  maxEdgeLengthMeters: number;
  bboxDiagonalMeters: number;
  selfIntersectionCount: number;
  triangleAreaToBBoxRatio: number;
};

const computePolygonMetrics = (coords: number[][][], geometryEngine: GeometryEngine): PolygonGeometryMetrics => {
  const outer = coords[0] ?? [];
  const areaMeters2 = computePolygonArea(coords, geometryEngine);
  const lineLengthMeters = computeRingLengthMeters(outer);
  const maxEdgeLengthMeters = computeRingMaxEdgeLengthMeters(outer);
  const { widthMeters, heightMeters } = computeOuterRingBounds(coords);
  const bboxDiagonalMeters = Math.hypot(widthMeters, heightMeters);
  const bboxArea = widthMeters * heightMeters;
  const isTriangle = countTriangleVertices(outer) === 3;
  const triangleAreaToBBoxRatio = isTriangle && bboxArea > 0
    ? areaMeters2 / bboxArea
    : 1;
  const selfIntersectionCount = countRingSelfIntersections(outer);
  return {
    areaMeters2,
    lineLengthMeters,
    maxEdgeLengthMeters,
    bboxDiagonalMeters,
    selfIntersectionCount,
    triangleAreaToBBoxRatio,
  };
};

const resolveOmitDetailsThreshold = (
  config: OmitDetailsConfig,
  zTarget: number,
): OmitDetailsThreshold => {
  const presets = OMIT_DETAILS_PRESETS[config.level];
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new Error(`omit-details thresholds missing for level: ${String(config.level)}`);
  }
  for (const threshold of presets) {
    if (zTarget <= threshold.maxZoom) return threshold;
  }
  const fallback = presets[presets.length - 1];
  if (!fallback) {
    throw new Error(`omit-details thresholds missing fallback for level: ${String(config.level)}`);
  }
  return fallback;
};

const shouldOmitByDetails = (
  coords: number[][][],
  config: OmitDetailsConfig,
  zTarget: number,
  geometryEngine: GeometryEngine,
): boolean => {
  const threshold = resolveOmitDetailsThreshold(config, zTarget);
  const metersPerPixelValue = metersPerPixel(zTarget);
  const { widthMeters, heightMeters } = computeOuterRingBounds(coords);
  const areaMeters = computePolygonArea(coords, geometryEngine);
  const widthPx = metersPerPixelValue > 0 ? widthMeters / metersPerPixelValue : 0;
  const heightPx = metersPerPixelValue > 0 ? heightMeters / metersPerPixelValue : 0;
  const areaPx2 = metersPerPixelValue > 0 ? areaMeters / (metersPerPixelValue * metersPerPixelValue) : 0;
  const bboxTooSmall = widthPx < threshold.minBBoxPx && heightPx < threshold.minBBoxPx;
  const areaTooSmall = areaPx2 < threshold.minAreaPx2;
  return bboxTooSmall || areaTooSmall;
};

const shouldExcludeByArea = (
  coords: number[][][],
  coefficient: number,
  zTarget: number,
  geometryEngine: GeometryEngine,
): boolean => {
  if (!Number.isFinite(coefficient) || coefficient <= 0) return false;
  const outlineLength = computeRingLengthMeters(coords[0] ?? []);
  if (outlineLength <= 0) return false;
  const area = computePolygonArea(coords, geometryEngine);
  const gridSizeMeters = metersPerPixel(zTarget);
  const threshold = (coefficient * gridSizeMeters * outlineLength) / 2;
  return area < threshold;
};

const filterPolygons = async (
  polygons: number[][][][],
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices?: number;
    geometryEngine: GeometryEngine;
    invalidGeometryFilter?: FetchInvalidGeometryFilterConfig;
    onInvalidGeometryCheck?: (progress: InvalidGeometryCheckProgress) => Promise<void> | void;
    polygonCounter: { current: number };
    polygonTotal: number;
  },
): Promise<number[][][][]> => {
  const filtered: number[][][][] = [];
  const minRingVertices = options.minRingVertices ?? 4;
  const checks = options.invalidGeometryFilter;
  for (const coords of polygons) {
    options.polygonCounter.current += 1;
    const polygonIndex = options.polygonCounter.current;
    const outer = coords[0] ?? [];
    if (outer.length < minRingVertices) continue;
    if (shouldOmitByDetails(coords, options.omitDetailsConfig, options.zTarget, options.geometryEngine)) continue;
    if (shouldExcludeByArea(coords, options.excludePolygonAreaCoefficient, options.zTarget, options.geometryEngine)) continue;
    if (checks && (checks.area || checks.lineLength || checks.maxEdgeLength || checks.selfIntersection || checks.triangleRingRatio)) {
      let metrics: PolygonGeometryMetrics | null = null;
      const resolveMetrics = (): PolygonGeometryMetrics => {
        if (!metrics) {
          metrics = computePolygonMetrics(coords, options.geometryEngine);
        }
        return metrics;
      };
      if (checks.area) {
        await options.onInvalidGeometryCheck?.({ check: 'area', polygonIndex, polygonTotal: options.polygonTotal });
        const areaMeters2 = resolveMetrics().areaMeters2;
        if (!Number.isFinite(areaMeters2) || areaMeters2 <= INVALID_FILTER_THRESHOLDS.minAreaMeters2) continue;
      }
      if (checks.lineLength) {
        await options.onInvalidGeometryCheck?.({ check: 'line length', polygonIndex, polygonTotal: options.polygonTotal });
        const lineLengthMeters = resolveMetrics().lineLengthMeters;
        if (!Number.isFinite(lineLengthMeters) || lineLengthMeters <= INVALID_FILTER_THRESHOLDS.minLineLengthMeters) continue;
      }
      if (checks.maxEdgeLength) {
        await options.onInvalidGeometryCheck?.({ check: 'max edge length', polygonIndex, polygonTotal: options.polygonTotal });
        const { maxEdgeLengthMeters, bboxDiagonalMeters } = resolveMetrics();
        if (!Number.isFinite(maxEdgeLengthMeters) || maxEdgeLengthMeters <= 0) continue;
        if (bboxDiagonalMeters > 0 && maxEdgeLengthMeters > bboxDiagonalMeters * INVALID_FILTER_THRESHOLDS.maxEdgeToBBoxDiagonalRatio) continue;
      }
      if (checks.selfIntersection) {
        await options.onInvalidGeometryCheck?.({ check: 'self intersection', polygonIndex, polygonTotal: options.polygonTotal });
        if (resolveMetrics().selfIntersectionCount > 0) continue;
      }
      if (checks.triangleRingRatio) {
        await options.onInvalidGeometryCheck?.({ check: 'triangle ring ratio', polygonIndex, polygonTotal: options.polygonTotal });
        if (resolveMetrics().triangleAreaToBBoxRatio < INVALID_FILTER_THRESHOLDS.minTriangleAreaToBBoxRatio) continue;
      }
    }
    filtered.push(coords);
  }
  return filtered;
};

const filterGeometry = async (
  geometry: Geometry,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices?: number;
    geometryEngine: GeometryEngine;
    invalidGeometryFilter?: FetchInvalidGeometryFilterConfig;
    onInvalidGeometryCheck?: (progress: InvalidGeometryCheckProgress) => Promise<void> | void;
    polygonCounter: { current: number };
    polygonTotal: number;
  },
): Promise<Geometry | null> => {
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    const filtered = await filterPolygons([coords], options);
    return filtered.length > 0 ? { ...geometry, coordinates: filtered[0] } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    const filtered = await filterPolygons(polygons, options);
    if (filtered.length === 0) return null;
    return { ...geometry, coordinates: filtered } as MultiPolygon;
  }
  return geometry;
};

const countPolygons = (geometry: Geometry | null | undefined): number => {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygons(child), 0);
  }
  return 0;
};

export const filterFetchCollectionByZoom = async (
  collection: FeatureCollection,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices?: number;
    geometryEngine: GeometryEngine;
    invalidGeometryFilter?: FetchInvalidGeometryFilterConfig;
    onInvalidGeometryCheck?: (progress: InvalidGeometryCheckProgress) => Promise<void> | void;
  },
): Promise<FeatureCollection> => {
  const features: Feature[] = [];
  const polygonCounter = { current: 0 };
  const polygonTotal = collection.features.reduce((sum, feature) => (
    sum + countPolygons(feature?.geometry ?? null)
  ), 0);
  for (const feature of collection.features) {
    if (!feature) continue;
    const geometry = feature.geometry ?? null;
    if (!geometry) continue;
    const filteredGeometry = await filterGeometry(geometry, {
      ...options,
      polygonCounter,
      polygonTotal,
    });
    if (!filteredGeometry) continue;
    features.push({ ...feature, geometry: filteredGeometry });
  }
  return { ...collection, features };
};
