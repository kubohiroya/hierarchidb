import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { Tile } from 'geojson-vt';
import type vtPbfNS = require('@maplibre/vt-pbf');
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';
import type { NodeId } from '@hierarchidb/core-types';
import type { GeometryEngine } from './config.js';
import { geometryArea } from './geometryEngine.js';

import {
  latToTileY,
  lonToTileX,
  pickAdminCode,
  pickAdminLevel,
  pickAdminName,
  pickCountryCode,
  pickCountryName,
} from './vectorTileUtils.js';

type GeojsonVtModule = typeof import('geojson-vt');
type GeojsonVtData = Parameters<GeojsonVtModule>[0];

export type VTMetadataContext = {
  dataSource?: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
};

export type VTGenerateConfig = {
  format?: 'mvt';
  compression?: 'gzip' | 'none';
  buffer?: number;
  minZoom?: number;
  maxZoom?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: VTMetadataContext;
  geometryEngine?: GeometryEngine;
  signal?: AbortSignal;
};

export type VTGenerateResult = {
  tilesGenerated: number;
  totalBytes: number;
  metadataCount?: number;
  tiles: VectorTileRow[];
  featureMetadata?: FeatureMetadataRow[];
};

export type VectorTileRow = {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
};

export type VectorTileProgress = {
  total: number;
  completed: number;
  percent: number;
  zoom: number;
  x: number;
  y: number;
};

export type FeatureCollectionLike = FeatureCollection<Geometry, GeoJsonProperties>;

type FeatureGeometry = Geometry | null;

type FeatureLike = Feature<Geometry, GeoJsonProperties>;

function buildUniqueFeatureId(
  feature: FeatureLike,
  index: number,
  metadataContext?: VTMetadataContext,
): string {
  const normalizeFeatureId = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return String(value ?? '');
  };

  const properties: Record<string, unknown> = feature.properties ?? {};
  const rawBaseId = properties.id ?? feature.id ?? index;
  const baseId = normalizeFeatureId(rawBaseId).trim();
  const adminCode = pickAdminCode(properties);
  const fallbackBaseId = baseId.length > 0 ? baseId : adminCode ?? `feature-${index}`;
  const countryCode = metadataContext?.countryCode ?? pickCountryCode(properties);
  const adminLevel = metadataContext?.adminLevel ?? pickAdminLevel(properties);
  const prefixParts = [
    countryCode,
    adminLevel != null ? `ADM${adminLevel}` : undefined,
    adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${fallbackBaseId}` : fallbackBaseId;
  return `${composed}:${index}`;
}

const normalizePropertyValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  return undefined;
};

const ensureMetadataProperties = (
  properties: Record<string, unknown>,
  metadataContext?: VTMetadataContext,
): void => {
  const rawCountryCode = metadataContext?.countryCode ?? pickCountryCode(properties);
  const normalizedCountryCode = normalizePropertyValue(rawCountryCode)?.toUpperCase();
  if (normalizedCountryCode && properties.countryCode === undefined) {
    properties.countryCode = normalizedCountryCode;
  }
  const adminCode = normalizePropertyValue(pickAdminCode(properties));
  if (adminCode && properties.adminCode === undefined) {
    properties.adminCode = adminCode;
  }
  const adminLevel = metadataContext?.adminLevel ?? pickAdminLevel(properties);
  if (adminLevel != null && properties.adminLevel === undefined) {
    properties.adminLevel = adminLevel;
  }
};

const long2tile = (lon: number, z: number) => lonToTileX(lon, z);

const lat2tile = (lat: number, z: number) => latToTileY(lat, z);

const updateBbox = (bbox: [number, number, number, number], coord: number[]) => {
  if (coord.length < 2) return;
  const lon = coord[0];
  const lat = coord[1];
  if (typeof lon !== 'number' || typeof lat !== 'number') return;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  if (lon < bbox[0]) bbox[0] = lon;
  if (lat < bbox[1]) bbox[1] = lat;
  if (lon > bbox[2]) bbox[2] = lon;
  if (lat > bbox[3]) bbox[3] = lat;
};

const extractGeometryStats = (geometry: FeatureGeometry | undefined, engine: GeometryEngine): {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
} => {
  if (!geometry) {
    return { vertexCount: 0, polygonCount: 0, bbox: undefined, area: 0 };
  }
  if (geometry.type === 'GeometryCollection') {
    return {
      vertexCount: 0,
      polygonCount: 0,
      bbox: undefined,
      area: 0,
    };
  }

  const { type, coordinates } = geometry;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    let fallbackArea = 0;
    try {
      fallbackArea = Math.max(0, geometryArea(geometry, engine));
    } catch {
      fallbackArea = 0;
    }
    return {
      vertexCount: 0,
      polygonCount: 0,
      bbox: undefined,
      area: fallbackArea,
    };
  }

  let vertexCount = 0;
  let polygonCount = 0;
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

  const updateFromRing = (ring: number[][]) => {
    if (!Array.isArray(ring)) return;
    vertexCount += ring.length;
    for (const coord of ring) {
      if (Array.isArray(coord)) {
        updateBbox(bbox, coord);
      }
    }
  };

  if (type === 'Polygon') {
    polygonCount = 1;
    const rings = coordinates as number[][][];
    if (Array.isArray(rings)) {
      for (const ring of rings) {
        updateFromRing(ring);
      }
    }
  } else {
    const polygons = coordinates as number[][][][];
    if (Array.isArray(polygons)) {
      polygonCount = polygons.length;
      for (const poly of polygons) {
        if (!Array.isArray(poly)) continue;
        for (const ring of poly) {
          updateFromRing(ring);
        }
      }
    }
  }

  let areaValue = 0;
  try {
    areaValue = Math.max(0, geometryArea(geometry, engine));
  } catch {
    areaValue = 0;
  }
  const finalBbox = bbox.every((value) => Number.isFinite(value)) ? bbox : undefined;

  return {
    vertexCount,
    polygonCount,
    bbox: finalBbox,
    area: areaValue,
  };
};

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollectionLike | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollectionLike;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: FeatureLike[] = [];
    for await (const feature of decoded as AsyncIterable<FeatureLike>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decodeFeatureCollectionFromJsonBuffer = async (buffer: ArrayBuffer): Promise<FeatureCollectionLike | null> => {
  try {
    const text = new TextDecoder().decode(new Uint8Array(buffer));
    const parsed = JSON.parse(text) as unknown;
    return await normalizeFeatureCollection(parsed);
  } catch {
    return null;
  }
};

const loadFlatGeobufGeojson = async () => {
  const mod = await import('flatgeobuf');
  return mod.geojson;
};

const decodeFeatureCollectionFromFlatGeobufBuffer = async (
  buffer: ArrayBuffer,
): Promise<FeatureCollectionLike | null> => {
  try {
    const geojsonApi = await loadFlatGeobufGeojson();
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded);
  } catch {
    return null;
  }
};

export const encodeFlatGeobufFromFeatureCollection = async (
  collection: FeatureCollectionLike,
): Promise<ArrayBuffer> => {
  const geojsonApi = await loadFlatGeobufGeojson();
  const encoded = await geojsonApi.serialize(collection);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
};


const loadGeojsonVt = async (): Promise<GeojsonVtModule> => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: GeojsonVtModule } & GeojsonVtModule;
  return candidate.default ?? candidate;
};

const loadVtPbf = async (): Promise<typeof vtPbfNS> => {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as unknown as { default?: typeof vtPbfNS } & typeof vtPbfNS;
  return candidate.default ?? candidate;
};

export const generateVectorTilesFromJsonBuffer = async (
  nodeId: NodeId,
  buffer: ArrayBuffer,
  config: VTGenerateConfig,
  onProgress?: (progress: VectorTileProgress) => void,
): Promise<VTGenerateResult> => {
  throwIfAborted(config.signal);
  const geojson = await decodeFeatureCollectionFromJsonBuffer(buffer);
  throwIfAborted(config.signal);
  if (!geojson) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
  return generateVectorTilesFromFeatureCollection(nodeId, geojson, config, onProgress);
};

export const generateVectorTilesFromFgbBuffer = async (
  nodeId: NodeId,
  buffer: ArrayBuffer,
  config: VTGenerateConfig,
  onProgress?: (progress: VectorTileProgress) => void,
): Promise<VTGenerateResult> => {
  throwIfAborted(config.signal);
  const geojson = await decodeFeatureCollectionFromFlatGeobufBuffer(buffer);
  throwIfAborted(config.signal);
  if (!geojson) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
  return generateVectorTilesFromFeatureCollection(nodeId, geojson, config, onProgress);
};

export const generateVectorTilesFromFeatureCollection = async (
  nodeId: NodeId,
  geojson: FeatureCollectionLike,
  config: VTGenerateConfig,
  onProgress?: (progress: VectorTileProgress) => void,
): Promise<VTGenerateResult> => {
  const startedAt = Date.now();
  throwIfAborted(config.signal);
  const features = geojson.features ?? [];
  if (features.length === 0) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };

  const metadataEnabled = Boolean(config.metadataEnabled);
  const metadataContext = config.metadataContext ?? {};
  const geometryEngine = config.geometryEngine ?? 'turf';
  const createdAt = Date.now();
  let metadataCount: number | undefined;
  let featureMetadata: FeatureMetadataRow[] | undefined;

  const metaStart = Date.now();
  if (metadataEnabled) {
    const records: FeatureMetadataRow[] = [];
    for (let index = 0; index < features.length; index++) {
      throwIfAborted(config.signal);
      const feature = features[index];
      if (!feature) continue;
      feature.properties = feature.properties ?? {};
      const properties = feature.properties;
      const tileFeatureId = buildUniqueFeatureId(feature, index, metadataContext);
      properties.id = tileFeatureId;
      ensureMetadataProperties(properties, metadataContext);
      const stats = extractGeometryStats(feature.geometry, geometryEngine);
      const countryName = metadataContext.countryName ?? pickCountryName(properties);
      const countryCode = metadataContext.countryCode ?? pickCountryCode(properties);
      const adminLevel = metadataContext.adminLevel ?? pickAdminLevel(properties);
      const adminName = pickAdminName(properties);
      const adminCode = pickAdminCode(properties);
      let admin1Name: string | undefined;
      let admin1Code: string | undefined;
      let admin2Name: string | undefined;
      let admin2Code: string | undefined;
      if (adminLevel === 1) {
        admin1Name = adminName;
        admin1Code = adminCode;
      } else if (adminLevel === 2) {
        admin2Name = adminName;
        admin2Code = adminCode;
      }
      records.push({
        id: `${nodeId}-${tileFeatureId}`,
        nodeId,
        featureId: tileFeatureId,
        countryName,
        countryCode,
        adminLevel,
        admin0Name: countryName,
        admin0Code: countryCode,
        admin1Name,
        admin1Code,
        admin2Name,
        admin2Code,
        dataSource: metadataContext.dataSource,
        createdAt,
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        bbox: stats.bbox,
        area: stats.area,
      });
    }
    featureMetadata = records;
    metadataCount = records.length;
  } else {
    for (let index = 0; index < features.length; index++) {
      throwIfAborted(config.signal);
      const feature = features[index];
      if (!feature) continue;
      const properties = feature.properties ?? {};
      properties.id = buildUniqueFeatureId(feature, index, metadataContext);
      ensureMetadataProperties(properties, metadataContext);
    }
  }
  console.debug('[VectorTiles] metadata pass', {
    nodeId,
    features: features.length,
    metadataEnabled,
    ms: Date.now() - metaStart,
  });

  const moduleStart = Date.now();
  const geojsonvt = await loadGeojsonVt();
  const vtpbf = await loadVtPbf();
  console.debug('[VectorTiles] modules loaded', { ms: Date.now() - moduleStart });
  const extent = 4096;
  const bufferValue = typeof config.buffer === 'number' ? config.buffer : 64;
  const fallbackMaxZoom = 6;
  const resolvedMinZoom = Number.isFinite(config.minZoom) ? Number(config.minZoom) : 0;
  const resolvedMaxZoom = Number.isFinite(config.maxZoom) ? Number(config.maxZoom) : fallbackMaxZoom;
  const zoomMin = Math.min(resolvedMinZoom, resolvedMaxZoom);
  const zoomMax = Math.max(resolvedMinZoom, resolvedMaxZoom);
  const targetZooms = Array.from({ length: zoomMax - zoomMin + 1 }, (_, z) => zoomMin + z);
  const indexMaxZoom = targetZooms.length > 0 ? Math.max(...targetZooms) : fallbackMaxZoom;
  const indexStart = Date.now();
  const index = geojsonvt(geojson as GeojsonVtData, {
    maxZoom: indexMaxZoom,
    extent,
    buffer: bufferValue,
    indexMaxZoom,
    promoteId: 'id',
  });
  throwIfAborted(config.signal);
  console.debug('[VectorTiles] index built', { ms: Date.now() - indexStart });

  const bboxStart = Date.now();
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    throwIfAborted(config.signal);
    const stats = extractGeometryStats(feature?.geometry, geometryEngine);
    if (!stats.bbox) continue;
    updateBbox(bbox, [stats.bbox[0], stats.bbox[1]]);
    updateBbox(bbox, [stats.bbox[2], stats.bbox[3]]);
  }
  console.debug('[VectorTiles] bbox computed', { ms: Date.now() - bboxStart });
  if (!bbox.every((value) => Number.isFinite(value))) {
    return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const tileRanges = targetZooms.map((z) => {
    const x1 = long2tile(minLon, z);
    const x2 = long2tile(maxLon, z);
    const y1 = lat2tile(maxLat, z);
    const y2 = lat2tile(minLat, z);
    const count = Math.max(0, (x2 - x1 + 1) * (y2 - y1 + 1));
    return { z, x1, x2, y1, y2, count };
  });
  const totalTiles = tileRanges.reduce((sum, range) => sum + range.count, 0);
  let processedTiles = 0;
  let lastPercent = -1;
  let lastUpdateAt = 0;
  const reportProgress = (z: number, x: number, y: number) => {
    if (!onProgress || totalTiles <= 0) return;
    processedTiles += 1;
    const percent = Math.min(100, (processedTiles / totalTiles) * 100);
    const now = Date.now();
    if (processedTiles === totalTiles || percent - lastPercent >= 1 || now - lastUpdateAt >= 750) {
      lastPercent = percent;
      lastUpdateAt = now;
      onProgress({ total: totalTiles, completed: processedTiles, percent, zoom: z, x, y });
    }
  };

  const tiles: VectorTileRow[] = [];
  let tilesGenerated = 0;
  let totalBytes = 0;
  let tilesWithFeatures = 0;
  let tilesWithoutFeatures = 0;
  const tileStart = Date.now();
  for (const range of tileRanges) {
    const { z, x1, x2, y1, y2 } = range;
    throwIfAborted(config.signal);
    for (let x = x1; x <= x2; x++) {
      throwIfAborted(config.signal);
      for (let y = y1; y <= y2; y++) {
        throwIfAborted(config.signal);
        const tile = index.getTile(z, x, y);
        const layer =
          tile && Array.isArray((tile as { features?: unknown[] }).features)
            ? (tile as Tile)
            : null;
        if (layer?.features?.length) {
          const layers: Record<string, Tile> = { layer0: layer };
          const pbf = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 });
          const bytes = pbf as Uint8Array;
          tilesGenerated++;
          tilesWithFeatures++;
          totalBytes += bytes.byteLength;
          tiles.push({
            z,
            x,
            y,
            data: bytes,
            size: bytes.byteLength,
            contentType: 'application/vnd.mapbox-vector-tile',
            timestamp: Date.now(),
          });
        } else {
          tilesWithoutFeatures++;
        }
        reportProgress(z, x, y);
      }
    }
  }
  console.debug('[VectorTiles] tiles built', {
    nodeId,
    tilesGenerated,
    totalTiles,
    ms: Date.now() - tileStart,
  });

  if (tilesWithoutFeatures > 0) {
    console.debug('[VectorTiles] Feature reduction summary', {
      nodeId,
      inputFeatures: features.length,
      tileCandidates: totalTiles,
      tilesWithFeatures,
      tilesWithoutFeatures,
    });
  }
  console.debug('[VectorTiles] total', { nodeId, ms: Date.now() - startedAt });
  return { tilesGenerated, totalBytes, metadataCount, tiles, featureMetadata };
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  if (typeof DOMException === 'function') {
    throw new DOMException('Vector tile generation aborted', 'AbortError');
  }
  const error = new Error('Vector tile generation aborted');
  (error as Error & { name: string }).name = 'AbortError';
  throw error;
};

// Tile persistence is handled by callers (runtime-worker adapters) instead of this module.
