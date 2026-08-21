import { type GeometryEngine, geometryArea, type OmitDetailsConfig } from '@hierarchidb/gis-sdk';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

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

const metersPerPixel = (z: number): number => (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * 2 ** z);

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
    const previous = ring[index - 1];
    const current = ring[index];
    if (!previous || !current) continue;
    const [previousX, previousY] = lonLatToMercator([previous[0] ?? 0, previous[1] ?? 0]);
    const [currentX, currentY] = lonLatToMercator([current[0] ?? 0, current[1] ?? 0]);
    length += Math.hypot(currentX - previousX, currentY - previousY);
  }
  return length;
};

const computeOuterRingBounds = (
  coordinates: number[][][]
): { widthMeters: number; heightMeters: number } => {
  const outer = coordinates[0];
  if (!outer || outer.length === 0) return { widthMeters: 0, heightMeters: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const position of outer) {
    const [x, y] = lonLatToMercator([position[0] ?? 0, position[1] ?? 0]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { widthMeters: Math.max(0, maxX - minX), heightMeters: Math.max(0, maxY - minY) };
};

const computePolygonArea = (coordinates: number[][][], geometryEngine: GeometryEngine): number =>
  Math.abs(geometryArea({ type: 'Polygon', coordinates } as Polygon, geometryEngine));

const resolveOmitDetailsThreshold = (
  config: OmitDetailsConfig,
  zTarget: number
): OmitDetailsThreshold => {
  const presets = OMIT_DETAILS_PRESETS[config.level];
  for (const threshold of presets) {
    if (zTarget <= threshold.maxZoom) return threshold;
  }
  throw new Error(`omit-details thresholds missing for level: ${String(config.level)}`);
};

const shouldOmitByDetails = (
  coordinates: number[][][],
  config: OmitDetailsConfig,
  zTarget: number,
  geometryEngine: GeometryEngine
): boolean => {
  const threshold = resolveOmitDetailsThreshold(config, zTarget);
  const metersPerPixelValue = metersPerPixel(zTarget);
  const { widthMeters, heightMeters } = computeOuterRingBounds(coordinates);
  const areaMeters = computePolygonArea(coordinates, geometryEngine);
  const widthPx = widthMeters / metersPerPixelValue;
  const heightPx = heightMeters / metersPerPixelValue;
  const areaPx2 = areaMeters / (metersPerPixelValue * metersPerPixelValue);
  return (
    (widthPx < threshold.minBBoxPx && heightPx < threshold.minBBoxPx) ||
    areaPx2 < threshold.minAreaPx2
  );
};

const shouldExcludeByArea = (
  coordinates: number[][][],
  coefficient: number,
  zTarget: number,
  geometryEngine: GeometryEngine
): boolean => {
  if (!Number.isFinite(coefficient) || coefficient <= 0) return false;
  const outer = coordinates[0];
  if (!outer) return true;
  const outlineLength = computeRingLengthMeters(outer);
  if (outlineLength <= 0) return true;
  const threshold = (coefficient * metersPerPixel(zTarget) * outlineLength) / 2;
  return computePolygonArea(coordinates, geometryEngine) < threshold;
};

const filterPolygons = (
  polygons: number[][][][],
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices: number;
    geometryEngine: GeometryEngine;
  }
): number[][][][] =>
  polygons.filter((coordinates) => {
    const outer = coordinates[0];
    if (!outer || outer.length < options.minRingVertices) return false;
    if (
      shouldOmitByDetails(
        coordinates,
        options.omitDetailsConfig,
        options.zTarget,
        options.geometryEngine
      )
    ) {
      return false;
    }
    return !shouldExcludeByArea(
      coordinates,
      options.excludePolygonAreaCoefficient,
      options.zTarget,
      options.geometryEngine
    );
  });

const filterGeometry = (
  geometry: Geometry,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices: number;
    geometryEngine: GeometryEngine;
  }
): Geometry | null => {
  if (geometry.type === 'Polygon') {
    const filtered = filterPolygons([geometry.coordinates as number[][][]], options);
    return filtered.length === 0 ? null : ({ ...geometry, coordinates: filtered[0] } as Polygon);
  }
  if (geometry.type === 'MultiPolygon') {
    const filtered = filterPolygons(geometry.coordinates as number[][][][], options);
    return filtered.length === 0 ? null : ({ ...geometry, coordinates: filtered } as MultiPolygon);
  }
  return geometry;
};

export const filterFetchCollectionByZoom = (
  collection: FeatureCollection,
  options: {
    zTarget: number;
    omitDetailsConfig: OmitDetailsConfig;
    excludePolygonAreaCoefficient: number;
    minRingVertices: number;
    geometryEngine: GeometryEngine;
  }
): FeatureCollection => {
  const features: Feature[] = [];
  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const filteredGeometry = filterGeometry(geometry, options);
    if (filteredGeometry) features.push({ ...feature, geometry: filteredGeometry });
  }
  return { ...collection, features };
};
