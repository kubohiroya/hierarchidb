import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeQueryAPI } from '@hierarchidb/plugin-service-api';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { booleanPointInPolygon, point } from '@turf/turf';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { LRUCache } from 'typescript-lru-cache';

export type VectorTileGeocodeMatch = {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  layerName: string;
  featureId?: string | number;
  properties: Record<string, unknown>;
  countryCode?: string;
  countryName?: string;
  adminName?: string;
  adminCode?: string;
  adminLevel?: number;
};

export type VectorTileGeocodeOptions = {
  layerName?: string;
  zoom?: number;
  maxZoomFallback?: number;
  adminLevels?: number[];
  maxMatches?: number;
  cache?: LRUCache<string, VectorTileLayerCache>;
};

export type VectorTileLayerCache = {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  layerName: string;
  features: Array<Feature<Polygon | MultiPolygon>>;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

const DEFAULT_LAYER_NAME = 'layer0';
const DEFAULT_CACHE_SIZE = 256;
const DEFAULT_MAX_ZOOM = 6;

const defaultCache = new LRUCache<string, VectorTileLayerCache>({
  maxSize: DEFAULT_CACHE_SIZE,
});

const toPropertyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  return undefined;
};

const toFeatureId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  return undefined;
};

const pickFirstString = (
  properties: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = toPropertyString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

const pickCountryName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['country', 'COUNTRY', 'COUNTRY_NAME', 'NAME_0', 'ADMIN', 'SOVEREIGNT']);

const pickCountryCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO']);

const pickAdminName = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, [
    'name',
    'NAME',
    'name_en',
    'NAME_EN',
    'shapeName',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
  ]);

const pickAdminCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['GID_0', 'GID_1', 'GID_2', 'GID_3', 'ADM1_CODE', 'ADM2_CODE', 'shapeID', 'code']);

const pickAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const long2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);

const lat2tile = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

const buildCacheKey = (nodeId: NodeId, z: number, x: number, y: number, layerName: string) =>
  `${nodeId}:${z}:${x}:${y}:${layerName}`;

const resolveZoom = async (
  query: ShapeQueryAPI,
  nodeId: NodeId,
  options?: VectorTileGeocodeOptions,
): Promise<number> => {
  if (typeof options?.zoom === 'number' && Number.isFinite(options.zoom)) {
    return options.zoom;
  }
  const summary = await query.getVectorTileSummary(nodeId);
  if (typeof summary.zoomMax === 'number') {
    return summary.zoomMax;
  }
  return options?.maxZoomFallback ?? DEFAULT_MAX_ZOOM;
};

const decodeVectorTileLayer = (
  tileData: Uint8Array,
  z: number,
  x: number,
  y: number,
  layerName: string,
): Array<Feature<Polygon | MultiPolygon>> => {
  const tile = new VectorTile(new Pbf(tileData));
  const layer = tile.layers[layerName];
  if (!layer) return [];
  const features: Array<Feature<Polygon | MultiPolygon>> = [];
  for (let index = 0; index < layer.length; index += 1) {
    const feature = layer.feature(index);
    const geojson = feature.toGeoJSON(x, y, z) as Feature;
    if (geojson?.geometry?.type !== 'Polygon' && geojson?.geometry?.type !== 'MultiPolygon') {
      continue;
    }
    features.push(geojson as Feature<Polygon | MultiPolygon>);
  }
  return features;
};

const loadVectorTileLayer = async (
  query: ShapeQueryAPI,
  nodeId: NodeId,
  z: number,
  x: number,
  y: number,
  layerName: string,
  cache: LRUCache<string, VectorTileLayerCache>,
): Promise<VectorTileLayerCache | null> => {
  const key = buildCacheKey(nodeId, z, x, y, layerName);
  const cached = cache.get(key);
  if (cached) return cached;
  const tileData = await query.getVectorTile(nodeId, z, x, y);
  if (!tileData) return null;
  const features = decodeVectorTileLayer(tileData, z, x, y, layerName);
  const entry: VectorTileLayerCache = {
    nodeId,
    z,
    x,
    y,
    layerName,
    features,
  };
  cache.set(key, entry);
  return entry;
};

export const createVectorTileGeocodeCache = (maxSize = DEFAULT_CACHE_SIZE) =>
  new LRUCache<string, VectorTileLayerCache>({ maxSize });

export const geocodePointInShapeTiles = async (
  query: ShapeQueryAPI,
  nodeIds: NodeId[] | NodeId,
  location: GeoPoint,
  options?: VectorTileGeocodeOptions,
): Promise<VectorTileGeocodeMatch[]> => {
  const targets = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  const layerName = options?.layerName ?? DEFAULT_LAYER_NAME;
  const cache = options?.cache ?? defaultCache;
  const results: VectorTileGeocodeMatch[] = [];
  const testPoint = point([location.longitude, location.latitude]);

  for (const nodeId of targets) {
    const z = await resolveZoom(query, nodeId, options);
    const x = long2tile(location.longitude, z);
    const y = lat2tile(location.latitude, z);
    const layer = await loadVectorTileLayer(query, nodeId, z, x, y, layerName, cache);
    if (!layer?.features.length) {
      continue;
    }
    for (const feature of layer.features) {
      if (!booleanPointInPolygon(testPoint, feature)) continue;
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const adminLevel = pickAdminLevel(properties);
      if (options?.adminLevels?.length && (adminLevel == null || !options.adminLevels.includes(adminLevel))) {
        continue;
      }
      results.push({
        nodeId,
        z,
        x,
        y,
        layerName,
        featureId: toFeatureId(feature.id) ?? toFeatureId(properties.id),
        properties,
        countryCode: pickCountryCode(properties),
        countryName: pickCountryName(properties),
        adminName: pickAdminName(properties),
        adminCode: pickAdminCode(properties),
        adminLevel,
      });
      if (options?.maxMatches && results.length >= options.maxMatches) {
        return results;
      }
    }
  }

  return results;
};
