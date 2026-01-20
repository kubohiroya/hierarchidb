import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import type { OmitDetailsConfig } from '@hierarchidb/gis-sdk';
import * as turf from '@turf/turf';

const turfArea = (turf as { area?: (input: unknown) => number }).area;

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

const clampQuantizeRank = (quantize?: number): number => {
  if (!Number.isFinite(quantize)) return 1;
  const rounded = Math.round(quantize as number);
  return Math.min(5, Math.max(1, rounded));
};

const resolveQuantizeFactor = (quantize?: number): number => {
  const rank = clampQuantizeRank(quantize);
  return Math.pow(2, rank - 1);
};

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

const computePolygonArea = (coords: number[][][]): number => {
  if (!turfArea) return 0;
  try {
    return Math.abs(turfArea({ type: 'Polygon', coordinates: coords } as Polygon));
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

const resolveOmitDetailsThreshold = (
  config: OmitDetailsConfig,
  zTarget: number,
): OmitDetailsThreshold => {
  const presets = OMIT_DETAILS_PRESETS[config.level];
  for (const threshold of presets) {
    if (zTarget <= threshold.maxZoom) return threshold;
  }
  return presets[presets.length - 1]!;
};

const shouldOmitByDetails = (
  coords: number[][][],
  config: OmitDetailsConfig,
  zTarget: number,
): boolean => {
  const threshold = resolveOmitDetailsThreshold(config, zTarget);
  const metersPerPixelValue = metersPerPixel(zTarget);
  const { widthMeters, heightMeters } = computeOuterRingBounds(coords);
  const areaMeters = computePolygonArea(coords);
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
  quantize?: number,
): boolean => {
  if (!Number.isFinite(coefficient) || coefficient <= 0) return false;
  const outlineLength = computeRingLengthMeters(coords[0] ?? []);
  if (outlineLength <= 0) return false;
  const area = computePolygonArea(coords);
  const gridSizeMeters = metersPerPixel(zTarget) * resolveQuantizeFactor(quantize);
  const threshold = (coefficient * gridSizeMeters * outlineLength) / 2;
  return area < threshold;
};

const filterPolygons = (
  polygons: number[][][][],
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    quantize?: number;
    minRingVertices?: number;
  },
): number[][][][] => {
  const filtered: number[][][][] = [];
  const minRingVertices = options.minRingVertices ?? 4;
  for (const coords of polygons) {
    const outer = coords[0] ?? [];
    if (outer.length < minRingVertices) continue;
    if (shouldOmitByDetails(coords, options.omitDetailsConfig, options.zTarget)) continue;
    if (shouldExcludeByArea(coords, options.excludePolygonAreaCoefficient, options.zTarget, options.quantize)) continue;
    filtered.push(coords);
  }
  return filtered;
};

const filterGeometry = (
  geometry: Geometry,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    quantize?: number;
    minRingVertices?: number;
  },
): Geometry | null => {
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    const filtered = filterPolygons([coords], options);
    return filtered.length > 0 ? { ...geometry, coordinates: filtered[0] } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    const filtered = filterPolygons(polygons, options);
    if (filtered.length === 0) return null;
    return { ...geometry, coordinates: filtered } as MultiPolygon;
  }
  return geometry;
};

export const filterFetchCollectionByZoom = (
  collection: FeatureCollection,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    quantize?: number;
    minRingVertices?: number;
  },
): FeatureCollection => {
  const features: Feature[] = [];
  for (const feature of collection.features) {
    if (!feature) continue;
    const geometry = feature.geometry ?? null;
    if (!geometry) continue;
    const filteredGeometry = filterGeometry(geometry, options);
    if (!filteredGeometry) continue;
    features.push({ ...feature, geometry: filteredGeometry });
  }
  return { ...collection, features };
};
