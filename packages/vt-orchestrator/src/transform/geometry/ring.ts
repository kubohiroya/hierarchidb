import type {
  Geometry,
  MultiPolygon,
} from 'geojson';
import type { GeometryEngine, RingFixConfig } from '@hierarchidb/gis-sdk';
import { computePolygonArea, hasNonFiniteCoords } from './metrics.js';

export const isRingClosed = (ring: number[][]): boolean => {
  if (ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return false;
  return first[0] === last[0] && first[1] === last[1];
};

const removeConsecutiveDuplicatePoints = (ring: number[][]): number[][] => {
  if (ring.length === 0) return ring;
  const cleaned: number[][] = [];
  let prev: number[] | null = null;
  ring.forEach((point) => {
    if (!prev || point[0] !== prev[0] || point[1] !== prev[1]) {
      cleaned.push(point);
      prev = point;
    }
  });
  return cleaned;
};

const removeCollinearPoints = (ring: number[][]): number[][] => {
  if (ring.length <= 4) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  const coords = first[0] === last[0] && first[1] === last[1]
    ? ring.slice(0, -1)
    : ring.slice();
  if (coords.length < 3) return ring;
  const result: number[][] = [];
  const epsilon = 1e-12;
  for (let i = 0; i < coords.length; i += 1) {
    const prev = coords[(i - 1 + coords.length) % coords.length];
    const curr = coords[i];
    const next = coords[(i + 1) % coords.length];
    if (!prev || !curr || !next) continue;
    const prevX = prev[0];
    const prevY = prev[1];
    const currX = curr[0];
    const currY = curr[1];
    const nextX = next[0];
    const nextY = next[1];
    if (
      prevX === undefined || prevY === undefined
      || currX === undefined || currY === undefined
      || nextX === undefined || nextY === undefined
    ) {
      continue;
    }
    const cross = (currX - prevX) * (nextY - prevY) - (currY - prevY) * (nextX - prevX);
    if (Math.abs(cross) > epsilon) {
      result.push(curr);
    }
  }
  if (result.length === 0) return ring;
  const firstResult = result[0];
  if (!firstResult) return ring;
  result.push(firstResult);
  return result;
};

const normalizeRing = (ring: number[][], config: RingFixConfig): number[][] => {
  let points = ring.slice();
  if (config.removeDuplicateConsecutivePoints) {
    points = removeConsecutiveDuplicatePoints(points);
  }
  if (config.removeCollinearPoints) {
    points = removeCollinearPoints(points);
  }
  if (points.length > 0) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return points;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      points = [...points, first];
    }
  }
  return points;
};

const computeRingArea = (ring: number[][], engine: GeometryEngine): number => {
  if (ring.length < 4) return 0;
  try {
    return Math.abs(computePolygonArea([ring], engine));
  } catch {
    return 0;
  }
};

const fixPolygonRings = (
  rings: number[][][],
  config: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
  geometryEngine: GeometryEngine,
): number[][][] | null => {
  const normalized = rings.map((ring) => normalizeRing(ring, config));
  const assessed = normalized.map((ring) => ({
    ring,
    area: computeRingArea(ring, geometryEngine),
    vertexCount: ring.length,
    isClosed: isRingClosed(ring),
    hasNonFinite: hasNonFiniteCoords(ring),
  }));
  const valid = assessed.filter(
    (entry) => !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices
      && entry.area >= minRingArea,
  );
  const fallback = assessed.filter(
    (entry) => !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices,
  );
  if (valid.length === 0 && fallback.length === 0) return null;
  const sorted = [...(valid.length > 0 ? valid : fallback)].sort((a, b) => b.area - a.area);
  const outer = sorted[0]?.ring ?? valid[0]?.ring ?? fallback[0]?.ring;
  if (!outer) return null;
  const holes = (dropInvalidHoles ? valid : assessed)
    .filter((entry) => entry.ring !== outer)
    .filter((entry) => !dropInvalidHoles || (
      !entry.hasNonFinite
      && entry.isClosed
      && entry.vertexCount >= config.minRingVertices
      && entry.area >= minRingArea
    ))
    .map((entry) => entry.ring);
  return [outer, ...holes].filter(
    (ring): ring is number[][] => Array.isArray(ring) && ring.length >= config.minRingVertices,
  );
};

export const applyRingFix = (
  geometry: Geometry,
  config: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
  geometryEngine: GeometryEngine,
): Geometry | null => {
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixed = fixPolygonRings(rings as number[][][], config, minRingArea, dropInvalidHoles, geometryEngine);
    return fixed ? { ...geometry, coordinates: fixed } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const fixedPolygons = polygons
      .map((rings) => fixPolygonRings(rings as number[][][], config, minRingArea, dropInvalidHoles, geometryEngine))
      .filter((rings): rings is number[][][] => Boolean(rings));
    if (fixedPolygons.length === 0) {
      return null;
    }
    return { ...geometry, coordinates: fixedPolygons } as MultiPolygon;
  }
  return geometry;
};
