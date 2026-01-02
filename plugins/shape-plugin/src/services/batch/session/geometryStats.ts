import type { Feature, Geometry } from 'geojson';
import { area as turfArea, bbox as turfBbox } from '@turf/turf';

export type GeometryStats = {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
};

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum, child) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygons = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.length;
  return 0;
};

export const extractGeometryStats = (feature: Feature): GeometryStats => {
  const geometry = feature.geometry ?? null;
  let bbox: [number, number, number, number] | undefined;
  try {
    const box = turfBbox(feature as unknown as Feature);
    if (box.every((value) => Number.isFinite(value))) {
      bbox = [box[0], box[1], box[2], box[3]];
    }
  } catch {
    bbox = undefined;
  }
  const vertexCount = countVerticesFromGeometry(geometry);
  const polygonCount = countPolygons(geometry);
  const area = geometry ? turfArea(feature as unknown as Feature) : 0;
  return { vertexCount, polygonCount, bbox, area };
};

