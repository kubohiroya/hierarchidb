import type { Feature } from 'geojson';

type NumberIndexable = { length: number; [index: number]: number };

const isNumberArrayView = (value: unknown): value is ArrayBufferView & NumberIndexable => {
  if (!ArrayBuffer.isView(value)) return false;
  if (typeof (value as { length?: unknown }).length !== 'number') return false;
  const view = value as unknown as NumberIndexable;
  return view.length > 0 && typeof view[0] === 'number';
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
