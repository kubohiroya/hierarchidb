import type { DownloadWorkerAPI, SimplifyWorkerAPI, VectorTileWorkerAPI } from '../types.js';
import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import { deserialize } from 'flatgeobuf/lib/mjs/geojson';
import type { Tile } from 'geojson-vt';
import area from '@turf/area';

// Use @types/vt-pbf for typing while importing '@maplibre/vt-pbf' at runtime-worker
import type vtPbfNS = require('@maplibre/vt-pbf');

import type { SharedDownloadService } from './downloadAdapter.js';
import { createSharedDownloadService } from './downloadAdapter.js';
import { TilesDB, type FeatureMetadataRow } from './TilesDB.js';

interface EphemeralBufferRow {
  id: string;
  sessionId: string;
  data: ArrayBuffer;
}

class ShapeEphemeralDB extends Dexie {
  rawBuffers!: Table<EphemeralBufferRow>;
  simplifiedBuffers!: Table<EphemeralBufferRow>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(1).stores({
      rawBuffers: '&id, sessionId, nodeId, timestamp',
      simplifiedBuffers: '&id, sessionId, nodeId, stage, timestamp',
    });
  }
}

let ephemeralDb: ShapeEphemeralDB | null = null;
const getEphemeralDb = (): ShapeEphemeralDB => {
  if (!ephemeralDb) {
    ephemeralDb = new ShapeEphemeralDB();
  }
  return ephemeralDb;
};

/**
 * StageProcessingService
 * Minimal worker-side surface for shape-plugin processing stages.
 *
 * NOTE: These are placeholders to define the contract and allow client wiring.
 *       Implementations can be incrementally replaced with real worker logic.
 */

class RealDownloadWorker implements DownloadWorkerAPI {
  private sharedPromise: Promise<SharedDownloadService> | null = null;

  private async getShared(): Promise<SharedDownloadService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 4 });
    }
    return this.sharedPromise;
  }

  async download(url: string, fileId: string, opts?: { expectedHash?: string }) {
    const shared = await this.getShared();
    const res = await shared.service.download(url, fileId, { expectedHash: opts?.expectedHash });
    return { fileId: res.fileId, sizeBytes: res.sizeBytes, hash: res.hash };
  }
}

// Minimal in-process registry to simulate buffer lineage across stages.
const bufferRegistry: Map<string, { parent?: string; stage: 's1' | 's2' | 'src'; ts: number }> =
  new Map();

class RealSimplifyWorker implements SimplifyWorkerAPI {
  async simplifyStage1(inputBufferId: string, _config: { tolerance: number; minArea: number }) {
    const out = `${inputBufferId}-s1`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's1', ts: Date.now() });
    return { outputBufferId: out };
  }
  async simplifyStage2(inputBufferId: string, _config: { zoomLevels: number[]; tileSize: number }) {
    const out = `${inputBufferId}-s2`;
    bufferRegistry.set(out, { parent: inputBufferId, stage: 's2', ts: Date.now() });
    return { outputBufferId: out };
  }
}

class RealVectorTileWorker implements VectorTileWorkerAPI {
  private sharedPromise: Promise<SharedDownloadService> | null = null;

  private async getShared(): Promise<SharedDownloadService> {
    if (!this.sharedPromise) {
      this.sharedPromise = createSharedDownloadService({ dbPrefix: 'hidb', perHostConcurrency: 2 });
    }
    return this.sharedPromise;
  }

  private async readBuffer(fileId: string): Promise<ArrayBuffer | null> {
    try {
      const shared = await this.getShared();
      const data = await shared.readAll(fileId);
      if (data && data.byteLength > 0) {
        return data;
      }
    } catch {
      // Ignore and fall back to ephemeral buffers.
    }
    const db = getEphemeralDb();
    const row = await db.simplifiedBuffers.get(fileId) ?? await db.rawBuffers.get(fileId);
    return row?.data ?? null;
  }

  private long2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * 2 ** z);
  }
  private lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
  }

  async generateTiles(
    inputBufferId: string,
    config: {
      format: 'mvt';
      compression?: 'gzip' | 'none';
      buffer?: number;
      minZoom?: number;
      maxZoom?: number;
      metadataEnabled?: boolean;
      metadataReplace?: boolean;
      metadataContext?: {
        dataSource?: string;
        countryCode?: string;
        countryName?: string;
        adminLevel?: number;
      };
    }
  ) {
    const buf = await this.readBuffer(inputBufferId);
    if (!buf) return { tilesGenerated: 0, totalBytes: 0 };
    const parsed = deserialize(new Uint8Array(buf));
    if (!parsed || parsed.type !== 'FeatureCollection') {
      return { tilesGenerated: 0, totalBytes: 0 };
    }
    const geojson = parsed as FeatureCollectionLike;
    const features = geojson.features ?? [];
    if (features.length === 0) return { tilesGenerated: 0, totalBytes: 0 };

    const sessionId = inputBufferId.includes('-simplify2-')
      ? inputBufferId.substring(0, inputBufferId.lastIndexOf('-simplify2-'))
      : inputBufferId;
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
        const tileFeatureId = normalizeFeatureId(properties.id ?? feature.id ?? index);
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
        if (properties.id == null) {
          properties.id = normalizeFeatureId(feature.id ?? index);
        }
      }
    }

    const geojsonvt = await loadGeojsonVt();
    // Runtime import; typed via @types/vt-pbf without ambient shims
    const vtpbf = await loadVtPbf();
    const extent = 4096;
    const buffer = typeof config.buffer === 'number' ? config.buffer : 64;
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
      buffer,
      indexMaxZoom,
      promoteId: 'id',
    });

    // Compute bbox
    let minLon = Infinity,
      minLat = Infinity,
      maxLon = -Infinity,
      maxLat = -Infinity;
    for (const f of features) {
      const c = f?.geometry?.coordinates;
      if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
        const lon = c[0],
          lat = c[1];
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
    if (
      !Number.isFinite(minLon) ||
      !Number.isFinite(minLat) ||
      !Number.isFinite(maxLon) ||
      !Number.isFinite(maxLat)
    ) {
      return { tilesGenerated: 0, totalBytes: 0 };
    }

    const db = await TilesDB.getSingleton();
    let tiles = 0;
    let totalBytes = 0;
    for (const z of targetZooms) {
      const x1 = this.long2tile(minLon, z);
      const x2 = this.long2tile(maxLon, z);
      const y1 = this.lat2tile(maxLat, z);
      const y2 = this.lat2tile(minLat, z);
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
              // Ensure ArrayBuffer, not SharedArrayBuffer union
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
  }

  async getTile(sessionId: string, z: number, x: number, y: number) {
    const db = await TilesDB.getSingleton();
    const key = `${sessionId}-${z}-${x}-${y}`;
    const row = await db.tiles.get(key);
    if (!row) return null;
    return new Uint8Array(row.data);
  }

  async listTiles(sessionId: string) {
    const db = await TilesDB.getSingleton();
    const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
    return rows.map((r) => ({ z: r.z, x: r.x, y: r.y, size: r.size, timestamp: r.timestamp }));
  }

  async getSummary(sessionId: string) {
    const db = await TilesDB.getSingleton();
    const rows = await db.tiles.where('sessionId').equals(sessionId).toArray();
    if (rows.length === 0) return { tiles: 0, totalBytes: 0 };
    const tiles = rows.length;
    const totalBytes = rows.reduce((s, r) => s + r.size, 0);
    const zooms = rows.map((r) => r.z);
    return { tiles, totalBytes, zoomMin: Math.min(...zooms), zoomMax: Math.max(...zooms) };
  }
}

export type StageProcessingService = {
  download: DownloadWorkerAPI;
  simplify: SimplifyWorkerAPI;
  vectortile: VectorTileWorkerAPI;
};

let singleton: StageProcessingService | null = null;

export async function getStageProcessingService(): Promise<StageProcessingService> {
  if (!singleton) {
    singleton = {
      download: new RealDownloadWorker(),
      simplify: new RealSimplifyWorker(),
      vectortile: new RealVectorTileWorker(),
    };
  }
  return singleton;
}

/**
 * getStageProcessingClient
 * A thin alias for client-side code (adapters) to access the service in the
 * current thread/process. In a multi-threaded deployment, this can be swapped
 * to a Comlink proxy or message-port client without changing consumers.
 */
export async function getStageProcessingClient(): Promise<StageProcessingService> {
  return getStageProcessingService();
}

// Comlink-based client factory for browser Worker threads
export async function createStageWorkerClient(): Promise<StageProcessingService> {
  // Note: stageWorker.entry is built to JS and emitted alongside index.ts
  const worker = new Worker(new URL('./stageWorker.entry.js', import.meta.url), { type: 'module' });
  const mod = (await import('comlink')) as typeof import('comlink');
  const client = mod.wrap<StageProcessingService>(worker);
  return client as unknown as StageProcessingService;
}
/// <reference path="../types/external.d.ts" />

type GeojsonVtModule = typeof import('geojson-vt');
type GeojsonVtData = Parameters<GeojsonVtModule>[0];
type TurfInput = Parameters<typeof area>[0];

async function loadGeojsonVt(): Promise<GeojsonVtModule> {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: GeojsonVtModule } & GeojsonVtModule;
  return candidate.default ?? candidate;
}

async function loadVtPbf(): Promise<typeof vtPbfNS> {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as unknown as { default?: typeof vtPbfNS } & typeof vtPbfNS;
  return candidate.default ?? candidate;
}

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

type FeatureCollectionLike = {
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
