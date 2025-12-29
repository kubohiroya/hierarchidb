import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { topology } from 'topojson-server';
import { feature as topojsonFeature } from 'topojson-client';
import { presimplify, simplify as simplifyTopology } from 'topojson-simplify';

type SimplifyTopoOptions = {
  tolerance: number;
  quantize?: number;
  zoomLevels?: number[];
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const updateBounds = (coords: unknown, bounds: Bounds): void => {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    const x = coords[0];
    const y = coords[1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
    return;
  }
  for (const child of coords) {
    updateBounds(child, bounds);
  }
};

const computeBBox = (geometry?: Geometry | null): [number, number, number, number] | null => {
  if (!geometry) return null;
  if (geometry.type === 'GeometryCollection') {
    const merged = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const child of geometry.geometries ?? []) {
      const childBox = computeBBox(child);
      if (!childBox) continue;
      merged.minX = Math.min(merged.minX, childBox[0]);
      merged.minY = Math.min(merged.minY, childBox[1]);
      merged.maxX = Math.max(merged.maxX, childBox[2]);
      merged.maxY = Math.max(merged.maxY, childBox[3]);
    }
    if (!Number.isFinite(merged.minX)) return null;
    return [merged.minX, merged.minY, merged.maxX, merged.maxY];
  }
  if ('coordinates' in geometry) {
    const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    updateBounds(geometry.coordinates, bounds);
    if (!Number.isFinite(bounds.minX)) return null;
    return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
  }
  return null;
};

const long2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);

const lat2tile = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

const normalizeZoomLevels = (zoomLevels?: number[]): number[] => {
  if (!zoomLevels || zoomLevels.length === 0) return [0];
  return zoomLevels.filter((value) => Number.isFinite(value));
};

const quantizeCoordinates = <T>(coords: T, quantize: number): T => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length === 0) return coords;
  if (typeof coords[0] === 'number') {
    return (coords as number[]).map((value) => Math.round(value * quantize) / quantize) as unknown as T;
  }
  return (coords as unknown[]).map((child) => quantizeCoordinates(child, quantize)) as unknown as T;
};

const applyQuantize = (feature: Feature, quantize?: number): Feature => {
  if (!quantize || quantize <= 0 || !feature.geometry) return feature;
  if (feature.geometry.type === 'GeometryCollection') return feature;
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: quantizeCoordinates(feature.geometry.coordinates, quantize),
    } as Geometry,
  };
};

const collectFeatures = (result: ReturnType<typeof topojsonFeature>): Feature[] => {
  if (result.type === 'FeatureCollection' && Array.isArray(result.features)) {
    return result.features as Feature[];
  }
  return [result as Feature];
};

export const simplifyTopoJsonByTiles = (
  collection: FeatureCollection,
  options: SimplifyTopoOptions,
): FeatureCollection => {
  const zoomLevels = normalizeZoomLevels(options.zoomLevels);
  const zoom = Math.min(...zoomLevels);
  const groups = new Map<string, Feature[]>();
  const orphaned: Feature[] = [];
  for (const feature of collection.features) {
    const bbox = computeBBox(feature.geometry ?? null);
    if (!bbox) {
      orphaned.push(feature);
      continue;
    }
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const midLon = (minLon + maxLon) / 2;
    const midLat = (minLat + maxLat) / 2;
    const x = long2tile(midLon, zoom);
    const y = lat2tile(midLat, zoom);
    const key = `${zoom}-${x}-${y}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(feature);
  }

  if (groups.size === 0) {
    return collection;
  }

  const results: Feature[] = [...orphaned];
  for (const features of groups.values()) {
    const topo = topology({
      collection: {
        type: 'FeatureCollection',
        features,
      } as FeatureCollection,
    });
    const presimplified = presimplify(topo);
    const simplified = Number.isFinite(options.tolerance) && options.tolerance > 0
      ? simplifyTopology(presimplified, options.tolerance)
      : presimplified;
    const restored = topojsonFeature(simplified, simplified.objects.collection as typeof simplified.objects[keyof typeof simplified.objects]);
    results.push(...collectFeatures(restored).map((entry) => applyQuantize(entry, options.quantize)));
  }

  return {
    type: 'FeatureCollection',
    features: results,
  };
};
