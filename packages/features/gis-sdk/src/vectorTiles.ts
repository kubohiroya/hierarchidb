import type { Tile } from 'geojson-vt';
import area from '@turf/area';
import type vtPbfNS = require('@maplibre/vt-pbf');
import { TilesDB, type FeatureMetadataRow } from './TilesDB.js';

type GeojsonVtModule = typeof import('geojson-vt');
type GeojsonVtData = Parameters<GeojsonVtModule>[0];
type TurfInput = Parameters<typeof area>[0];

export type VectorTileMetadataContext = {
  dataSource?: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
};

export type VectorTileGenerateConfig = {
  format?: 'mvt';
  compression?: 'gzip' | 'none';
  buffer?: number;
  minZoom?: number;
  maxZoom?: number;
  metadataEnabled?: boolean;
  metadataReplace?: boolean;
  metadataContext?: VectorTileMetadataContext;
};

export type VectorTileGenerateResult = {
  tilesGenerated: number;
  totalBytes: number;
  metadataCount?: number;
};

export type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features?: FeatureLike[];
};

type FeatureGeometry = {
  type?: string;
  coordinates?: unknown;
};

type FeatureLike = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: FeatureGeometry;
};

const normalizeFeatureId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return String(value ?? '');
};

const toPropertyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
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

const buildUniqueFeatureId = (
  feature: FeatureLike,
  index: number,
  metadataContext?: VectorTileMetadataContext,
): string => {
  const properties = (feature.properties ??= {});
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
};

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

const extractGeometryStats = (geometry?: FeatureGeometry): {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
} => {
  if (!geometry) {
    return { vertexCount: 0, polygonCount: 0, bbox: undefined, area: 0 };
  }
  const { type, coordinates } = geometry;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    let fallbackArea = 0;
    try {
      fallbackArea = Math.max(0, area(geometry as unknown as TurfInput));
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
    areaValue = Math.max(0, area(geometry as unknown as TurfInput));
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
    return collection;
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

const long2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);

const lat2tile = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
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
  sessionId: string,
  buffer: ArrayBuffer,
  config: VectorTileGenerateConfig,
): Promise<VectorTileGenerateResult> => {
  const geojson = await decodeFeatureCollectionFromJsonBuffer(buffer);
  if (!geojson) return { tilesGenerated: 0, totalBytes: 0 };
  return generateVectorTilesFromFeatureCollection(sessionId, geojson, config);
};

export const generateVectorTilesFromFeatureCollection = async (
  sessionId: string,
  geojson: FeatureCollectionLike,
  config: VectorTileGenerateConfig,
): Promise<VectorTileGenerateResult> => {
  const features = geojson.features ?? [];
  if (features.length === 0) return { tilesGenerated: 0, totalBytes: 0 };

  const metadataEnabled = Boolean(config.metadataEnabled);
  const metadataContext = config.metadataContext ?? {};
  const createdAt = Date.now();
  let metadataCount: number | undefined;

  if (metadataEnabled) {
    const db = await TilesDB.getSingleton();
    if (config.metadataReplace) {
      await db.featureMetadata.where('sessionId').equals(sessionId).delete();
    }
    const records: FeatureMetadataRow[] = [];
    for (let index = 0; index < features.length; index++) {
      const feature = features[index];
      if (!feature) continue;
      const properties = (feature.properties ??= {});
      const tileFeatureId = buildUniqueFeatureId(feature, index, metadataContext);
      properties.id = tileFeatureId;
      const stats = extractGeometryStats(feature.geometry);
      records.push({
        id: `${sessionId}-${tileFeatureId}`,
        sessionId,
        featureId: tileFeatureId,
        countryName: metadataContext.countryName ?? pickCountryName(properties),
        countryCode: metadataContext.countryCode ?? pickCountryCode(properties),
        adminName: pickAdminName(properties),
        adminLevel: metadataContext.adminLevel ?? pickAdminLevel(properties),
        adminCode: pickAdminCode(properties),
        dataSource: metadataContext.dataSource,
        createdAt,
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        bbox: stats.bbox,
        area: stats.area,
      });
    }
    if (records.length > 0) {
      await db.featureMetadata.bulkPut(records);
    }
    metadataCount = records.length;
  } else {
    for (let index = 0; index < features.length; index++) {
      const feature = features[index];
      if (!feature) continue;
      const properties = (feature.properties ??= {});
      properties.id = buildUniqueFeatureId(feature, index, metadataContext);
    }
  }

  const geojsonvt = await loadGeojsonVt();
  const vtpbf = await loadVtPbf();
  const extent = 4096;
  const bufferValue = typeof config.buffer === 'number' ? config.buffer : 64;
  const fallbackMaxZoom = 6;
  const resolvedMinZoom = Number.isFinite(config.minZoom) ? Number(config.minZoom) : 0;
  const resolvedMaxZoom = Number.isFinite(config.maxZoom) ? Number(config.maxZoom) : fallbackMaxZoom;
  const zoomMin = Math.min(resolvedMinZoom, resolvedMaxZoom);
  const zoomMax = Math.max(resolvedMinZoom, resolvedMaxZoom);
  const targetZooms = Array.from({ length: zoomMax - zoomMin + 1 }, (_, z) => zoomMin + z);
  const indexMaxZoom = targetZooms.length > 0 ? Math.max(...targetZooms) : fallbackMaxZoom;
  const index = geojsonvt(geojson as GeojsonVtData, {
    maxZoom: indexMaxZoom,
    extent,
    buffer: bufferValue,
    indexMaxZoom,
    promoteId: 'id',
  });

  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    const stats = extractGeometryStats(feature?.geometry);
    if (!stats.bbox) continue;
    updateBbox(bbox, [stats.bbox[0], stats.bbox[1]]);
    updateBbox(bbox, [stats.bbox[2], stats.bbox[3]]);
  }
  if (!bbox.every((value) => Number.isFinite(value))) {
    return { tilesGenerated: 0, totalBytes: 0 };
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;

  const db = await TilesDB.getSingleton();
  let tiles = 0;
  let totalBytes = 0;
  for (const z of targetZooms) {
    const x1 = long2tile(minLon, z);
    const x2 = long2tile(maxLon, z);
    const y1 = lat2tile(maxLat, z);
    const y2 = lat2tile(minLat, z);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const tile = index.getTile(z, x, y);
        const layer =
          tile && Array.isArray((tile as { features?: unknown[] }).features)
            ? (tile as Tile)
            : null;
        if (layer?.features?.length) {
          const layers: Record<string, Tile> = { layer0: layer };
          const pbf = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 });
          const bytes = pbf as Uint8Array;
          tiles++;
          totalBytes += bytes.byteLength;
          const key = `${sessionId}-${z}-${x}-${y}`;
          await db.tiles.put({
            key,
            sessionId,
            z,
            x,
            y,
            data: bytes.slice().buffer,
            size: bytes.byteLength,
            contentType: 'application/vnd.mapbox-vector-tile',
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return { tilesGenerated: tiles, totalBytes, metadataCount };
};

export const getVectorTile = async (
  sessionId: string,
  z: number,
  x: number,
  y: number,
): Promise<Uint8Array | null> => {
  const db = await TilesDB.getSingleton();
  const key = `${sessionId}-${z}-${x}-${y}`;
  const row = await db.tiles.get(key);
  if (!row) return null;
  return new Uint8Array(row.data);
};

export const listVectorTiles = async (sessionId: string) => {
  const db = await TilesDB.getSingleton();
  const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
  return rows.map((row) => ({
    z: row.z,
    x: row.x,
    y: row.y,
    size: row.size,
    timestamp: row.timestamp,
  }));
};

export const getVectorTileSummary = async (sessionId: string) => {
  const db = await TilesDB.getSingleton();
  const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
  if (rows.length === 0) return { tiles: 0, totalBytes: 0 };
  const tiles = rows.length;
  const totalBytes = rows.reduce((sum, row) => sum + row.size, 0);
  let zoomMin = rows[0]?.z ?? 0;
  let zoomMax = rows[0]?.z ?? 0;
  for (const row of rows) {
    if (row.z < zoomMin) zoomMin = row.z;
    if (row.z > zoomMax) zoomMax = row.z;
  }
  return { tiles, totalBytes, zoomMin, zoomMax };
};
