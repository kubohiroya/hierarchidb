import type { Feature, Geometry } from 'geojson';
import * as turf from '@turf/turf';

const turfBbox = (turf as { bbox?: (input: unknown) => number[] }).bbox;
const turfArea = (turf as { area?: (input: unknown) => number }).area;

const countVertices = (coords: unknown): number => {
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  return countVertices(geometry.coordinates);
};

const countPolygonsFromGeometry = (geometry?: Geometry | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') {
    return 1;
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const safeBbox = (feature: Feature<Geometry>): [number, number, number, number] | null => {
  if (!turfBbox) return null;
  try {
    const result = turfBbox(feature);
    if (!Array.isArray(result) || result.length !== 4) return null;
    const [minLon, minLat, maxLon, maxLat] = result;
    if (
      minLon === undefined
      || minLat === undefined
      || maxLon === undefined
      || maxLat === undefined
    ) {
      return null;
    }
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) return null;
    return [minLon, minLat, maxLon, maxLat];
  } catch {
    return null;
  }
};

const safeArea = (feature: Feature<Geometry>): number => {
  if (!turfArea) return 0;
  try {
    const value = turfArea(feature);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const buildFeatureId = (
  feature: Feature,
  index: number,
  metadata: { countryCode?: string; adminLevel?: number; adminCode?: string },
): string => {
  const normalizeFeatureId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return String(value ?? '');
  };
  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const rawBaseId = properties.id ?? feature.id ?? index;
  const baseId = normalizeFeatureId(rawBaseId).trim();
  const fallbackBaseId = baseId.length > 0 ? baseId : metadata.adminCode ?? `feature-${index}`;
  const prefixParts = [
    metadata.countryCode,
    metadata.adminLevel != null ? `ADM${metadata.adminLevel}` : undefined,
    metadata.adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${fallbackBaseId}` : fallbackBaseId;
  return `${composed}:${index}`;
};

export const extractGeometryStats = (feature: Feature): {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
} => {
  const geometry = feature.geometry ?? null;
  const vertexCount = countVerticesFromGeometry(geometry);
  const polygonCount = countPolygonsFromGeometry(geometry);
  let bbox: [number, number, number, number] | undefined;
  const resolvedBbox = safeBbox(feature as Feature<Geometry>);
  if (resolvedBbox) {
    bbox = resolvedBbox;
  }
  const area = safeArea(feature as Feature<Geometry>);
  return { vertexCount, polygonCount, bbox, area };
};
