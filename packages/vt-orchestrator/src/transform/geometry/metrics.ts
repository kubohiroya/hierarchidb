import type { GeometryEngine } from '@hierarchidb/gis-sdk';
import { geometryArea } from '@hierarchidb/gis-sdk';
import type { Geometry, Polygon } from 'geojson';

export type LonLat = [number, number];
export type Mercator = [number, number];
export type GeometryWithCoords = Exclude<Geometry, { type: 'GeometryCollection' }>;

const EARTH_RADIUS = 6378137;
const MVT_EXTENT = 4096;
const MAX_MERCATOR_LAT = 85.05112878;

export const metersPerPixel = (z: number): number => {
  return (2 * Math.PI * EARTH_RADIUS) / (MVT_EXTENT * Math.pow(2, z));
};

export const clampQuantizeRank = (quantize?: number): number => {
  if (!Number.isFinite(quantize)) return 1;
  const rounded = Math.round(quantize as number);
  return Math.min(5, Math.max(1, rounded));
};

export const resolveQuantizeFactor = (quantize?: number): number => {
  const rank = clampQuantizeRank(quantize);
  return Math.pow(2, rank - 1);
};

export const lonLatToMercator = ([lon, lat]: LonLat): Mercator => {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    throw new Error('lon/lat must be finite');
  }
  const clampedLat = Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360));
  return [x, y];
};

export const mercatorToLonLat = ([x, y]: Mercator): LonLat => {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
};

export const computeRingLengthMeters = (ring: number[][]): number => {
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

export const computePolygonArea = (coords: number[][][], engine: GeometryEngine): number => {
  try {
    return Math.abs(geometryArea({ type: 'Polygon', coordinates: coords } as Polygon, engine));
  } catch {
    return 0;
  }
};

export const computeOuterRingArea = (coords: number[][][], engine: GeometryEngine): number => {
  const outer = coords[0];
  if (!outer || outer.length === 0) return 0;
  return computePolygonArea([outer], engine);
};

export const computeOuterRingBounds = (
  coords: number[][][]
): { widthMeters: number; heightMeters: number } => {
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
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return { widthMeters: 0, heightMeters: 0 };
  }
  return { widthMeters: Math.max(0, maxX - minX), heightMeters: Math.max(0, maxY - minY) };
};

export const computePolygonOutlineLength = (coords: number[][][]): number => {
  const outer = coords[0] ?? [];
  return computeRingLengthMeters(outer);
};

export const mapCoords = (coords: unknown, map: (coord: LonLat) => LonLat): unknown => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    const [lon, lat] = coords as LonLat;
    return map([lon, lat]);
  }
  return coords.map((child: unknown) => mapCoords(child, map));
};

export const hasNonFiniteCoords = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') {
    const [lon, lat] = coords as number[];
    return !Number.isFinite(lon) || !Number.isFinite(lat);
  }
  return coords.some((child: unknown) => hasNonFiniteCoords(child));
};

export const hasNonFiniteGeometry = (geometry: Geometry): boolean => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.some((child) => hasNonFiniteGeometry(child));
  }
  return hasNonFiniteCoords((geometry as GeometryWithCoords).coordinates);
};

export const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

export const countVerticesFromGeometry = (geometry: Geometry): number => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices((geometry as GeometryWithCoords).coordinates);
};

export const countRingsFromGeometry = (geometry: Geometry): number => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countRingsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return rings.length;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polygons.reduce((sum, rings) => sum + (Array.isArray(rings) ? rings.length : 0), 0);
  }
  return 0;
};

export const mapGeometry = (geometry: Geometry, map: (coord: LonLat) => LonLat): Geometry => {
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return {
      type: 'GeometryCollection',
      geometries: geometries.map((child: Geometry) => mapGeometry(child, map)),
    };
  }
  const coordsGeometry = geometry as GeometryWithCoords;
  return {
    ...coordsGeometry,
    coordinates: mapCoords(coordsGeometry.coordinates, map),
  } as Geometry;
};
