import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Tile } from 'geojson-vt';
import type vtPbfNS = require('@maplibre/vt-pbf');
import { geometryBboxClip } from '@hierarchidb/gis-sdk';
import { packTileId, parentToChildRange, unpackTileId } from '../tiles/tileId.js';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { VTStageContext } from '../contexts.js';
import type { BandConfig, StageHandler, StageHandlerResult, VtTaskInput } from '../types/types.js';
import { updateTask, VtTaskQueueDb } from '../task/taskQueue.js';
import type { EphemeralTransformCacheRecord } from '@hierarchidb/gis-sdk';

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    const iterator = (decoded as AsyncIterable<Feature>)[Symbol.asyncIterator]();
    const testIterTimeoutMs = (globalThis as { __HDB_VT_ASYNC_ITER_TIMEOUT_MS?: number }).__HDB_VT_ASYNC_ITER_TIMEOUT_MS;
    while (true) {
      const next = typeof testIterTimeoutMs === 'number' && testIterTimeoutMs > 0
        ? await new Promise<IteratorResult<Feature>>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`[vt] async iterator timeout after ${testIterTimeoutMs}ms`));
          }, testIterTimeoutMs);
          iterator.next()
            .then((value) => resolve(value))
            .catch((error) => reject(error))
            .finally(() => clearTimeout(timeoutId));
        })
        : await iterator.next();
      if (next.done) break;
      features.push(next.value);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decodeTransformByBandCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

const loadGeojsonVt = async () => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};

const loadVtPbf = async (): Promise<typeof vtPbfNS> => {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as unknown as { default?: typeof vtPbfNS } & typeof vtPbfNS;
  return candidate.default ?? candidate;
};

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

const formatCount = (value: number): string => value.toLocaleString('en-US');

const resolveAdminLevel = (feature: Feature): number | null => {
  const props = feature.properties as Record<string, unknown> | undefined;
  const layer = typeof props?.layer === 'string' ? props.layer : '';
  if (layer.endsWith('-boundary')) return null;
  const level = typeof props?.level === 'number' ? props.level : null;
  if (typeof level === 'number' && Number.isFinite(level)) return level;
  const match = layer.match(/^admin(\d+)/);
  return match ? Number(match[1]) : null;
};

const buildAdminFeatureSummary = (collection: FeatureCollection): string => {
  const counts = new Map<number, number>();
  collection.features.forEach((feature) => {
    if (!feature) return;
    const level = resolveAdminLevel(feature);
    if (level === null || Number.isNaN(level)) return;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  });
  if (counts.size === 0) return 'features: none';
  const parts = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => `ADM${level}:${formatCount(count)}`);
  return `features: ${parts.join(' / ')}`;
};

type TileBBox = { minX: number; minY: number; maxX: number; maxY: number };

type InputFeatureStats = {
  bbox: TileBBox;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
  bufferId: string;
};

const canonicalLineKey = (coords: number[][]): string => {
  const toKey = (points: number[][]): string =>
    points
      .map((p) => {
        const x = p[0] ?? 0;
        const y = p[1] ?? 0;
        return ((x << 16) ^ y).toString();
      })
      .join(',');
  const a = toKey(coords);
  const b = toKey([...coords].reverse());
  return a < b ? a : b;
};

const dedupeTileLines = (tile: Tile): Tile => {
  const seen = new Set<string>();
  const out: Tile['features'] = [];

  for (const feature of tile.features) {
    if (feature.type !== 2) {
      out.push(feature);
      continue;
    }
    const newGeom: number[][][] = [];
    const lines = (feature.geometry ?? []) as unknown as number[][][];
    for (const line of lines) {
      const key = canonicalLineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        newGeom.push(line);
      }
    }
    if (newGeom.length > 0) {
      out.push({ ...feature, geometry: newGeom as unknown as Tile['features'][number]['geometry'] });
    }
  }

  return { ...tile, features: out };
};

const toDeg = (r: number): number => r * 180 / Math.PI;

const tileToBBox = (z: number, x: number, y: number): TileBBox => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

const bboxIntersects = (a: TileBBox, b: TileBBox): boolean => (
  a.minX <= b.maxX
  && a.maxX >= b.minX
  && a.minY <= b.maxY
  && a.maxY >= b.minY
);

const expandTileBBox = (bbox: TileBBox, buffer: number, extent: number): TileBBox => {
  if (!Number.isFinite(buffer) || buffer <= 0) return bbox;
  if (!Number.isFinite(extent) || extent <= 0) return bbox;
  const lonSpan = bbox.maxX - bbox.minX;
  const latSpan = bbox.maxY - bbox.minY;
  if (!Number.isFinite(lonSpan) || !Number.isFinite(latSpan)) return bbox;
  const factor = buffer / extent;
  const lonMargin = lonSpan * factor;
  const latMargin = latSpan * factor;
  return {
    minX: bbox.minX - lonMargin,
    minY: bbox.minY - latMargin,
    maxX: bbox.maxX + lonMargin,
    maxY: bbox.maxY + latMargin,
  };
};

const hasCoordinates = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') return true;
  return coords.some((entry) => hasCoordinates(entry));
};

const isEmptyGeometry = (geometry: Geometry | null | undefined): boolean => {
  if (!geometry) return true;
  if (geometry.type === 'GeometryCollection') {
    return !geometry.geometries.some((child) => !isEmptyGeometry(child));
  }
  return !hasCoordinates((geometry as Geometry & { coordinates?: unknown }).coordinates);
};

const isClipGeometry = (
  geometry: Geometry,
): geometry is LineString | MultiLineString | Polygon | MultiPolygon => (
  geometry.type === 'LineString'
  || geometry.type === 'MultiLineString'
  || geometry.type === 'Polygon'
  || geometry.type === 'MultiPolygon'
);

const isPointGeometry = (geometry: Geometry): geometry is Point | MultiPoint => (
  geometry.type === 'Point' || geometry.type === 'MultiPoint'
);

const isPointInBBox = (x: number, y: number, bbox: TileBBox): boolean => (
  x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
);

const isAnyPointInBBox = (geometry: Point | MultiPoint, bbox: TileBBox): boolean => {
  if (geometry.type === 'Point') {
    const x = geometry.coordinates[0] ?? NaN;
    const y = geometry.coordinates[1] ?? NaN;
    return Number.isFinite(x) && Number.isFinite(y) && isPointInBBox(x, y, bbox);
  }
  return geometry.coordinates.some((point) => {
    const x = point[0] ?? NaN;
    const y = point[1] ?? NaN;
    return Number.isFinite(x) && Number.isFinite(y) && isPointInBBox(x, y, bbox);
  });
};

const isNumberArrayLike = (value: unknown): value is ArrayLike<number> => (
  Array.isArray(value) && typeof value[0] === 'number'
);

type NumberIndexable = { length: number; [index: number]: number };

const isNumberArrayView = (value: unknown): value is ArrayBufferView & NumberIndexable => {
  if (!ArrayBuffer.isView(value)) return false;
  if (typeof (value as { length?: unknown }).length !== 'number') return false;
  const view = value as unknown as NumberIndexable;
  return view.length > 0 && typeof view[0] === 'number';
};

const featureBBox = (feature: Feature): TileBBox | null => {
  const geometry = feature?.geometry ?? null;
  if (!geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (p: unknown): void => {
    if (isNumberArrayView(p)) {
      const coords = p;
      for (let i = 0; i + 1 < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return;
    }
    if (isNumberArrayLike(p)) {
      const coords = p as ArrayLike<number>;
      const x = coords[0];
      const y = coords[1];
      if (typeof x !== 'number' || typeof y !== 'number') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return;
    }
    if (Array.isArray(p)) {
      p.map((child) => visit(child));
    }
  };
  const visitGeometry = (geom: Feature['geometry']): void => {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') {
      const geometries = Array.isArray(geom.geometries) ? geom.geometries : [];
      geometries.map((child) => visitGeometry(child));
      return;
    }
    if ('coordinates' in geom) {
      visit(geom.coordinates as unknown);
    }
  };
  visitGeometry(geometry);
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
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

const countVerticesFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  const coords = 'coordinates' in geometry ? geometry.coordinates : undefined;
  return countVertices(coords);
};

const countPolygonsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
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

const countLineStringsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
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

const countTileVertices = (geometry: unknown): number => {
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

const countTilePolygons = (geometry: unknown): number => {
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

const countTileLineStrings = (geometry: unknown): number => {
  if (!Array.isArray(geometry)) return 0;
  if (geometry.length === 0) return 0;
  const first = geometry[0];
  if (Array.isArray(first) && typeof first[0] === 'number') return 1;
  return geometry.length;
};

const buildBufferSetHash = (bufferIds: string[]): string => {
  const sorted = [...bufferIds].sort();
  const json = JSON.stringify(sorted);
  const encoder = new TextEncoder();
  const port = new NobleSha3HashPort();
  return port.digest(encoder.encode(json).buffer, 'sha3-256');
};

const buildLayerMap = (collection: FeatureCollection): Map<string, Feature[]> => {
  const map = new Map<string, Feature[]>();
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties ?? {};
    const layer = typeof props.layer === 'string' ? props.layer : 'admin0';
    const bucket = map.get(layer);
    if (bucket) {
      bucket.push(feature);
    } else {
      map.set(layer, [feature]);
    }
  }
  return map;
};

const getHeapSnapshot = (): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null => {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } })
    .memory;
  return memory ? {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  } : null;
};

const describeBuffer = (buffer: ArrayBuffer): {
  byteLength: number;
  headHex: string;
  headAscii: string;
  isJsonLike: boolean;
} => {
  const bytes = new Uint8Array(buffer);
  const head = bytes.slice(0, 16);
  const headHex = Array.from(head).map((value) => value.toString(16).padStart(2, '0')).join('');
  const headAscii = Array.from(head).map((value) => (
    value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
  )).join('');
  let firstNonWhitespace: number | null = null;
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (value === undefined) continue;
    if (value === 0x20 || value === 0x0a || value === 0x0d || value === 0x09) continue;
    firstNonWhitespace = value;
    break;
  }
  const isJsonLike = firstNonWhitespace === 0x7b || firstNonWhitespace === 0x5b;
  return {
    byteLength: bytes.byteLength,
    headHex,
    headAscii,
    isJsonLike,
  };
};

const collectFeatures = async (
  context: VTStageContext,
  bufferIds: string[],
  nodeId: string,
  options?: { groupByContinent?: boolean; continentByCountry?: Map<string, string> },
): Promise<{
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
} | null> => {
  const allFeatures: Feature[] = [];
  const featureStats: InputFeatureStats[] = [];
  const bufferSizes = new Map<string, number>();
  const featuresByContinent = options?.groupByContinent ? new Map<string, Feature[]>() : undefined;
  const debugCollect = (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT === true;
  if (debugCollect) {
    const testTimeoutMs = (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS;
    console.info('[vt][debug] collect buffers', JSON.stringify({
      nodeId,
      bufferCount: bufferIds.length,
      testTimeoutMs: typeof testTimeoutMs === 'number' ? testTimeoutMs : null,
    }));
  }
  if (debugCollect) {
    const countStartedAt = Date.now();
    console.info('[vt][debug] collect count start', JSON.stringify({ nodeId }));
    const count = await context.ephemeralDB.transformCache.count();
    console.info('[vt][debug] collect count done', JSON.stringify({
      nodeId,
      count,
      durationMs: Date.now() - countStartedAt,
    }));
    console.info('[vt][debug] collect fetch start', JSON.stringify({
      nodeId,
      useBulkGet: (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET === true,
      bufferCount: bufferIds.length,
    }));
  }
  const useBulkGet = (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET === true;
  const useGetEach = (globalThis as { __HDB_VT_COLLECT_GET_EACH?: boolean }).__HDB_VT_COLLECT_GET_EACH === true;
  const records: EphemeralTransformCacheRecord[] = await context.ephemeralDB.transaction('r', [context.ephemeralDB.transformCache], async () => {
    if (debugCollect) {
      console.info('[vt][debug] collect transaction start', JSON.stringify({ nodeId }));
    }
    let loaded: EphemeralTransformCacheRecord[];
    if (useGetEach) {
      const collected: EphemeralTransformCacheRecord[] = [];
      for (const bufferId of bufferIds) {
        if (debugCollect) {
          console.info('[vt][debug] collect get start', JSON.stringify({ nodeId, bufferId }));
        }
        const record = await context.ephemeralDB.transformCache.get(bufferId);
        if (debugCollect) {
          console.info('[vt][debug] collect get done', JSON.stringify({
            nodeId,
            bufferId,
            hasRecord: Boolean(record),
          }));
        }
        if (record) {
          collected.push(record);
        }
      }
      loaded = collected;
    } else if (useBulkGet) {
      loaded = (await context.ephemeralDB.transformCache.bulkGet(bufferIds)).filter((record): record is typeof records[number] => Boolean(record));
    } else {
      loaded = await context.ephemeralDB.transformCache
        .where('id')
        .anyOf(bufferIds)
        .toArray();
    }
    if (debugCollect) {
      console.info('[vt][debug] collect transaction done', JSON.stringify({ nodeId }));
    }
    return loaded;
  });
  for (const record of records) {
    if (!record || record.timestamp <= 0) continue;
    bufferSizes.set(record.id, record.data.byteLength);
    if (debugCollect) {
      console.info('[vt][debug] decode start', JSON.stringify({
        nodeId,
        bufferId: record.id,
        byteLength: record.data.byteLength,
      }));
    }
    const collection = await decodeTransformByBandCache(record.data);
    if (debugCollect) {
      console.info('[vt][debug] decode done', JSON.stringify({
        nodeId,
        bufferId: record.id,
        hasCollection: Boolean(collection),
        featureCount: collection?.features?.length ?? 0,
      }));
    }
    if (!collection) {
      const debug = describeBuffer(record.data);
      console.warn('[shape-vt] failed to decode transform cache for vt stage', JSON.stringify({
        nodeId,
        bufferId: record.id,
        timestamp: record.timestamp,
        byteLength: debug.byteLength,
        headHex: debug.headHex,
        headAscii: debug.headAscii,
        jsonLike: debug.isJsonLike,
      }));
      continue;
    }
    const continentKey = featuresByContinent
      ? (() => {
        const rawCountry = record.countryCode ?? record.sourceKey?.split(':')[0] ?? '';
        const code = rawCountry.trim().toUpperCase();
        const continent = code ? options?.continentByCountry?.get(code) : undefined;
        return continent ?? 'Unknown';
      })()
      : null;
    collection.features.forEach((feature) => {
      allFeatures.push(feature);
      if (featuresByContinent && continentKey) {
        const bucket = featuresByContinent.get(continentKey);
        if (bucket) {
          bucket.push(feature);
        } else {
          featuresByContinent.set(continentKey, [feature]);
        }
      }
      const bbox = featureBBox(feature);
      if (!bbox) return;
      featureStats.push({
        bbox,
        vertexCount: countVerticesFromGeometry(feature.geometry),
        polygonCount: countPolygonsFromGeometry(feature.geometry),
        lineStringCount: countLineStringsFromGeometry(feature.geometry),
        bufferId: record.id,
      });
    });
  }
  if (allFeatures.length === 0) return null;
  return {
    collection: { type: 'FeatureCollection', features: allFeatures },
    featureStats,
    bufferSizes,
    ...(featuresByContinent ? { featuresByContinent } : {}),
  };
};

type GeojsonVtIndex = { getTile: (z: number, x: number, y: number) => Tile | null };

const buildTilesByZoom = (
  band: BandConfig,
  parent: { z: number; x: number; y: number }
): Map<number, { total: number; generated: number }> => {
  const tilesByZoom = new Map<number, { total: number; generated: number }>();
  for (let z = band.zMin; z <= band.zMax; z++) {
    const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
    const total = Math.max(0, xEnd - xStart + 1) * Math.max(0, yEnd - yStart + 1);
    tilesByZoom.set(z, { total, generated: 0 });
  }
  return tilesByZoom;
};

const buildTileSummary = (tilesByZoom: Map<number, { total: number; generated: number }>): string => {
  if (tilesByZoom.size === 0) return 'tiles -> 0/0';
  const parts = Array.from(tilesByZoom.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, counts]) => `${formatCount(counts.generated)}/${formatCount(counts.total)}`);
  return `tiles -> ${parts.join(', ')}`;
};

const buildSkippedMessage = (featureSummary: string, tileSummary: string, reason: string): string => (
  `${featureSummary}, ${tileSummary} (skipped: ${reason})`
);

type OutputTileTotals = {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
};

const computeOutputTileTotals = (tiles: Tile[]): OutputTileTotals => {
  const totals: OutputTileTotals = {
    featureCount: 0,
    vertexCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
  };
  tiles.forEach((tile) => {
    const features = Array.isArray(tile.features) ? tile.features : [];
    totals.featureCount += features.length;
    features.forEach((feature) => {
      if (feature.type === 3) {
        totals.polygonCount += countTilePolygons(feature.geometry);
        totals.vertexCount += countTileVertices(feature.geometry);
      } else if (feature.type === 2) {
        totals.lineStringCount += countTileLineStrings(feature.geometry);
        totals.vertexCount += countTileVertices(feature.geometry);
      } else {
        totals.vertexCount += countTileVertices(feature.geometry);
      }
    });
  });
  return totals;
};

export const vtStageTestUtils = {
  buildAdminFeatureSummary,
  buildTileSummary,
  buildSkippedMessage,
  computeOutputTileTotals,
};
type FeatureWithBBox = { feature: Feature; bbox: TileBBox };

const buildFeaturesWithBBox = (features: Feature[]): FeatureWithBBox[] => (
  features
    .map((feature) => ({ feature, bbox: featureBBox(feature) }))
    .filter((entry): entry is FeatureWithBBox => Boolean(entry.bbox))
);

const clipFeaturesForTile = (
  featuresWithBBox: FeatureWithBBox[],
  tileBBox: TileBBox,
): Feature<Geometry>[] => {
  const clippedFeatures: Feature<Geometry>[] = [];
  for (const entry of featuresWithBBox) {
    if (!bboxIntersects(entry.bbox, tileBBox)) continue;
    const sourceFeature = entry.feature;
    const geometry = sourceFeature.geometry;
    let clipped: Feature<Geometry> | null = null;
    if (geometry && isClipGeometry(geometry)) {
      clipped = geometryBboxClip(
        sourceFeature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
        [tileBBox.minX, tileBBox.minY, tileBBox.maxX, tileBBox.maxY],
      ) as Feature<Geometry>;
    } else if (geometry && isPointGeometry(geometry)) {
      if (isAnyPointInBBox(geometry, tileBBox)) {
        clipped = sourceFeature as Feature<Geometry>;
      }
    }
    if (!clipped || isEmptyGeometry(clipped.geometry)) continue;
    clippedFeatures.push(clipped);
  }
  return clippedFeatures;
};

const buildLayerIndexes = async (
  context: VTStageContext,
  layers: Map<string, Feature[]>,
  band: BandConfig,
  debugContext?: {
    taskId: string;
    nodeId: string;
    bandIndex?: number | null;
    tileId?: number | null;
    continent?: string;
  }
): Promise<Map<string, GeojsonVtIndex>> => {
  const geojsonvt = await loadGeojsonVt();
  const indexes = new Map<string, GeojsonVtIndex>();
  const startAt = Date.now();
  if (debugContext) {
    console.info('[vt] index build start', JSON.stringify({
      ...debugContext,
      layerCount: layers.size,
      featureCount: Array.from(layers.values()).reduce((sum, features) => sum + features.length, 0),
      zRange: [band.zMin, band.zMax],
    }));
  }
  for (const [layerName, features] of layers.entries()) {
    if (features.length === 0) continue;

    //if ( > 0 && !vtConfig.layers.includes(layerName)) continue;
    //if (vtConfig.layers.length > 0 && !vtConfig.layers.includes(layerName)) continue;
    const layerStats = debugContext ? features.reduce((stats, feature) => {
      stats.featureCount += 1;
      stats.vertexCount += countVerticesFromGeometry(feature.geometry);
      stats.polygonCount += countPolygonsFromGeometry(feature.geometry);
      stats.lineStringCount += countLineStringsFromGeometry(feature.geometry);
      return stats;
    }, { featureCount: 0, vertexCount: 0, polygonCount: 0, lineStringCount: 0 }) : null;
    const layerStartedAt = Date.now();
    if (debugContext && layerStats) {
      console.info('[vt] layer index start', JSON.stringify({
        ...debugContext,
        layerName,
        ...layerStats,
        heap: getHeapSnapshot(),
      }));
    }
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const index = geojsonvt(collection, {
      maxZoom: band.zMax,
      indexMaxZoom: band.zMax,
      extent: context.vtConfig.extent,
      buffer: context.vtConfig.bufferSize,
      tolerance: context.vtConfig.tolerance,
      promoteId: context.vtConfig.promoteId,
      indexMaxPoints: context.vtConfig.indexMaxPoints > 0 ? context.vtConfig.indexMaxPoints : undefined,
    });
    indexes.set(layerName, index as unknown as GeojsonVtIndex);
    if (debugContext && layerStats) {
      console.info('[vt] layer index done', JSON.stringify({
        ...debugContext,
        layerName,
        ...layerStats,
        duration: Date.now() - layerStartedAt,
        heap: getHeapSnapshot(),
      }));
    }
  }
  if (debugContext) {
    console.info('[vt] index build done', JSON.stringify({
      ...debugContext,
      layerCount: layers.size,
      indexCount: indexes.size,
      duration: Date.now() - startAt,
    }));
  }
  return indexes;
};

export const createVtHandler = (context: VTStageContext): StageHandler<VtTaskInput> => {
  const { bands, vtConfig, tileWriter, abortSignal } = context;
  const layerSetName = vtConfig.layerSetName;
  if (!layerSetName) {
    throw new Error('vt stage requires layerSetName');
  }
  const bandMap = new Map(bands.map((band) => [band.bandIndex, band] as const));
  const taskQueue = new VtTaskQueueDb();

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    const bufferIds = input?.bufferIds ?? [];
    const bufferIdSample = bufferIds.length > 0
      ? bufferIds.slice(0, Math.min(bufferIds.length, 3))
      : [];
    const taskContext = {
      taskId: task.taskId,
      nodeId: String(task.nodeId),
      bandIndex: input?.bandIndex,
      tileId: input?.tileId,
      bufferCount: bufferIds.length,
    };
    try {
      if (!input) {
        return { status: 'failed', errorMessage: 'vt task input is missing' };
      }
      if (!input.bufferIds || input.bufferIds.length === 0) {
        return { status: 'completed', message: 'skipped: bufferIds is empty' };
      }
      const band = bandMap.get(input.bandIndex);
      if (!band) {
        return { status: 'failed', errorMessage: `Unknown bandIndex: ${input.bandIndex}` };
      }
      const parent = unpackTileId(input.tileId, band.zBase);
      const groupByContinent = Boolean(
        context.continentByCountry
        && parent.z === 0
        && parent.x === 0
        && parent.y === 0
      );
      if (groupByContinent) {
        console.info('[vt] continent grouping enabled', JSON.stringify({
          ...taskContext,
          zRange: [band.zMin, band.zMax],
        }));
      }

      console.info('[vt] task start', JSON.stringify({
        ...taskContext,
        zRange: [band.zMin, band.zMax],
        layerSetName,
        bufferIdSample,
      }));

      assertNotAborted(abortSignal);
      const collectStartedAt = Date.now();
      console.info('[vt] collect start', JSON.stringify({
        ...taskContext,
        bufferCount: input.bufferIds.length,
        heap: getHeapSnapshot(),
      }));
      const testTimeoutMs = (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS;
      const collectPromise = collectFeatures(
        context,
        input.bufferIds,
        String(task.nodeId),
        { groupByContinent, continentByCountry: context.continentByCountry }
      );
      const collected = typeof testTimeoutMs === 'number' && testTimeoutMs > 0
        ? await new Promise<Awaited<typeof collectPromise>>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(
              `[vt] collect timeout after ${testTimeoutMs}ms (nodeId=${String(task.nodeId)}, taskId=${task.taskId})`
            ));
          }, testTimeoutMs);
          collectPromise
            .then((value) => resolve(value))
            .catch((error) => reject(error))
            .finally(() => clearTimeout(timeoutId));
        })
        : await collectPromise;
      console.info('[vt] collect done', JSON.stringify({
        ...taskContext,
        bufferCount: input.bufferIds.length,
        duration: Date.now() - collectStartedAt,
        collected: Boolean(collected),
        heap: getHeapSnapshot(),
      }));
      if (!collected) {
        return { status: 'completed', message: 'skipped: no features' };
      }

      const { collection, featureStats, bufferSizes, featuresByContinent } = collected;
      const adminFeatureSummary = buildAdminFeatureSummary(collection);
      const tilesByZoom = buildTilesByZoom(band, parent);
      const totalTiles = Array.from(tilesByZoom.values()).reduce((sum, counts) => sum + counts.total, 0);
      const tileSummary = buildTileSummary(tilesByZoom);
      const parentBBox = tileToBBox(parent.z, parent.x, parent.y);
      const intersectingFeatureCount = featureStats.filter((stats) => bboxIntersects(stats.bbox, parentBBox)).length;
      if (intersectingFeatureCount === 0) {
        const sample = featureStats.slice(0, 3).map((stats) => ({
          bbox: stats.bbox,
          vertexCount: stats.vertexCount,
          polygonCount: stats.polygonCount,
          lineStringCount: stats.lineStringCount,
          bufferId: stats.bufferId,
        }));
        console.warn('[vt] no intersecting features for parent tile', JSON.stringify({
          ...taskContext,
          parentTile: parent,
          parentBBox,
          totalFeatures: collection.features.length,
          featureStatsCount: featureStats.length,
          sample,
        }));
        return {
          status: 'completed',
          message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no intersecting features for parent tile'),
        };
      }
      let totalBufferBytes = 0;
      let maxBufferBytes = 0;
      bufferSizes.forEach((size) => {
        totalBufferBytes += size;
        if (size > maxBufferBytes) maxBufferBytes = size;
      });
      console.info('[vt] feature collection ready', JSON.stringify({
        ...taskContext,
        features: collection.features.length,
        bufferBytes: totalBufferBytes,
        maxBufferBytes,
        duration: Date.now() - collectStartedAt,
        heap: getHeapSnapshot(),
      }));

      assertNotAborted(abortSignal);
      const collectLayerForTile = (
        index: GeojsonVtIndex,
        layerName: string,
        z: number,
        x: number,
        y: number,
      ): Tile | null => {
        const tile = index.getTile(z, x, y) as Tile | null;
        if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) return null;
        const finalTile = vtConfig.boundaryDedupe && layerName.endsWith('-boundary')
          ? dedupeTileLines(tile)
          : tile;
        if (!Array.isArray(finalTile.features) || finalTile.features.length === 0) return null;
        return finalTile;
      };

      const collectLayersForTileFromIndexes = (
        indexes: Map<string, GeojsonVtIndex>,
        z: number,
        x: number,
        y: number,
      ): Record<string, Tile> | null => {
        const layers: Record<string, Tile> = {};
        for (const [layerName, index] of indexes.entries()) {
          const tile = collectLayerForTile(index, layerName, z, x, y);
          if (!tile) continue;
          layers[layerName] = tile;
        }
        return Object.keys(layers).length > 0 ? layers : null;
      };

      const mergeLayerTiles = (
        target: Record<string, Tile>,
        addition: Record<string, Tile>,
      ): void => {
        Object.entries(addition).forEach(([layerName, tile]) => {
          const existing = target[layerName];
          if (!existing) {
            target[layerName] = tile;
            return;
          }
          const existingFeatures = Array.isArray(existing.features) ? existing.features : [];
          const nextFeatures = Array.isArray(tile.features) ? tile.features : [];
          target[layerName] = {
            ...existing,
            features: [...existingFeatures, ...nextFeatures],
          };
        });
      };

      assertNotAborted(abortSignal);
      const vtpbfStartedAt = Date.now();
      console.info('[vt] vtpbf load start', JSON.stringify({
        ...taskContext,
        heap: getHeapSnapshot(),
      }));
      const vtpbf = await loadVtPbf();
      console.info('[vt] vtpbf load done', JSON.stringify({
        ...taskContext,
        duration: Date.now() - vtpbfStartedAt,
        heap: getHeapSnapshot(),
      }));
      console.info('[vt] tiling start', JSON.stringify({
        ...taskContext,
        zRange: [band.zMin, band.zMax],
        totalTiles,
        parentTile: parent,
        heap: getHeapSnapshot(),
      }));
      if (totalTiles === 0) {
        return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no tiles') };
      }
      const bufferSetHash = buildBufferSetHash(input.bufferIds);
      let indexes: Map<string, GeojsonVtIndex> | null = null;
      let aggregatedLayersByTileId: Map<number, Record<string, Tile>> | null = null;
      if (groupByContinent && featuresByContinent && featuresByContinent.size > 1) {
        aggregatedLayersByTileId = new Map();
        for (const [continent, features] of featuresByContinent.entries()) {
          if (features.length === 0) continue;
          const continentMap = buildLayerMap({ type: 'FeatureCollection', features });
          if (continentMap.size === 0) continue;
          const continentIndexes = await buildLayerIndexes(context, continentMap, band, {
            ...taskContext,
            continent,
          });
          if (continentIndexes.size === 0) continue;
          for (let z = band.zMin; z <= band.zMax; z++) {
            assertNotAborted(abortSignal);
            const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
            for (let x = xStart; x <= xEnd; x++) {
              assertNotAborted(abortSignal);
              for (let y = yStart; y <= yEnd; y++) {
                assertNotAborted(abortSignal);
                const layers = collectLayersForTileFromIndexes(continentIndexes, z, x, y);
                if (!layers) continue;
                const tileId = packTileId(x, y, z);
                const existing = aggregatedLayersByTileId.get(tileId);
                if (existing) {
                  mergeLayerTiles(existing, layers);
                } else {
                  aggregatedLayersByTileId.set(tileId, layers);
                }
              }
            }
          }
        }
        if (aggregatedLayersByTileId.size === 0) {
          console.warn('[vt] no layers after continent grouping', JSON.stringify({
            ...taskContext,
            parentTile: parent,
            zRange: [band.zMin, band.zMax],
            totalTiles,
            continentCount: featuresByContinent?.size ?? 0,
          }));
          return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
        }
      } else {
        const layerMap = buildLayerMap(collection);
        const forcePerTileIndex = band.zMin >= 3;
        console.info('[vt] layer map ready', JSON.stringify({
          ...taskContext,
          layerCount: layerMap.size,
          heap: getHeapSnapshot(),
        }));
        if (layerMap.size === 0) {
          return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
        }
        if (forcePerTileIndex) {
          const perTileStats = Array.from(layerMap.values()).reduce(
            (stats, features) => {
              stats.featureCount += features.length;
              features.forEach((feature) => {
                const vertices = countVerticesFromGeometry(feature.geometry);
                stats.layerVertexCount += vertices;
                stats.maxFeatureVertices = Math.max(stats.maxFeatureVertices, vertices);
              });
              return stats;
            },
            { featureCount: 0, layerVertexCount: 0, maxFeatureVertices: 0 },
          );
          const perTileIndexStartedAt = Date.now();
          console.info('[vt] per-tile index start', JSON.stringify({
            ...taskContext,
            layerCount: layerMap.size,
            ...perTileStats,
            zRange: [band.zMin, band.zMax],
            heap: getHeapSnapshot(),
          }));
          console.info('[vt] per-tile index enabled', JSON.stringify({
            ...taskContext,
            layerCount: layerMap.size,
            ...perTileStats,
            zRange: [band.zMin, band.zMax],
          }));
          aggregatedLayersByTileId = new Map();
          let emptyTileWithFeatures: {
            z: number;
            x: number;
            y: number;
            layerName: string;
            clippedFeatureCount: number;
            featureCount: number;
          } | null = null;
          const geojsonvt = await loadGeojsonVt();
          const featuresWithBBoxByLayer = new Map<string, FeatureWithBBox[]>();
          layerMap.forEach((features, layerName) => {
            const featuresWithBBox = buildFeaturesWithBBox(features);
            if (features.length > 0 && featuresWithBBox.length === 0) {
              console.warn('[vt] layer has features but no bbox', JSON.stringify({
                ...taskContext,
                layerName,
                featureCount: features.length,
              }));
            }
            featuresWithBBoxByLayer.set(layerName, featuresWithBBox);
          });
          for (let z = band.zMin; z <= band.zMax; z++) {
            assertNotAborted(abortSignal);
            const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
            for (let x = xStart; x <= xEnd; x++) {
              assertNotAborted(abortSignal);
              for (let y = yStart; y <= yEnd; y++) {
                assertNotAborted(abortSignal);
                const tileBBox = expandTileBBox(
                  tileToBBox(z, x, y),
                  vtConfig.bufferSize,
                  vtConfig.extent,
                );
                const layersForTile: Record<string, Tile> = {};
                for (const [layerName, featuresWithBBox] of featuresWithBBoxByLayer.entries()) {
                  if (featuresWithBBox.length === 0) continue;
                  const clippedFeatures = clipFeaturesForTile(featuresWithBBox, tileBBox);
                  if (clippedFeatures.length === 0) continue;
                  const collection: FeatureCollection = { type: 'FeatureCollection', features: clippedFeatures };
                  const index = geojsonvt(collection, {
                    maxZoom: z,
                    indexMaxZoom: z,
                    extent: context.vtConfig.extent,
                    buffer: context.vtConfig.bufferSize,
                    tolerance: context.vtConfig.tolerance,
                    promoteId: context.vtConfig.promoteId,
                    indexMaxPoints: context.vtConfig.indexMaxPoints > 0 ? context.vtConfig.indexMaxPoints : undefined,
                  }) as GeojsonVtIndex;
                  const tile = collectLayerForTile(index, layerName, z, x, y);
                  if (!tile) {
                    if (!emptyTileWithFeatures) {
                      emptyTileWithFeatures = {
                        z,
                        x,
                        y,
                        layerName,
                        clippedFeatureCount: clippedFeatures.length,
                        featureCount: featuresWithBBox.length,
                      };
                    }
                    continue;
                  }
                  layersForTile[layerName] = tile;
                }
                if (Object.keys(layersForTile).length === 0) continue;
                const tileId = packTileId(x, y, z);
                aggregatedLayersByTileId.set(tileId, layersForTile);
              }
            }
          }
          console.info('[vt] per-tile index done', JSON.stringify({
            ...taskContext,
            layerCount: layerMap.size,
            tileCount: aggregatedLayersByTileId.size,
            duration: Date.now() - perTileIndexStartedAt,
            heap: getHeapSnapshot(),
          }));
          if (emptyTileWithFeatures) {
            console.warn('[vt] geojson-vt produced empty tile for clipped features', JSON.stringify({
              ...taskContext,
              parentTile: parent,
              zRange: [band.zMin, band.zMax],
              totalTiles,
              ...emptyTileWithFeatures,
            }));
            return {
              status: 'completed',
              message: buildSkippedMessage(
                adminFeatureSummary,
                tileSummary,
                'geojson-vt produced empty tile for clipped features',
              ),
            };
          }
          if (aggregatedLayersByTileId.size === 0) {
            const layerStats = Array.from(layerMap.entries()).map(([layerName, features]) => ({
              layerName,
              featureCount: features.length,
              featuresWithBBox: featuresWithBBoxByLayer.get(layerName)?.length ?? 0,
            }));
            console.warn('[vt] per-tile index produced no layers', JSON.stringify({
              ...taskContext,
              parentTile: parent,
              zRange: [band.zMin, band.zMax],
              totalTiles,
              layerCount: layerMap.size,
              intersectingFeatureCount,
              layerStats,
            }));
            return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
          }
        } else if (layerMap.size === 1) {
          const [entry] = layerMap.entries();
          if (!entry) {
            return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
          }
          const [layerName, features] = entry;
          const perFeatureVertexThreshold = 20000;
          const perFeatureMaxVertices = 10000;
          const layerVertexCount = features
            ? features.reduce((sum, feature) => sum + countVerticesFromGeometry(feature.geometry), 0)
            : 0;
          const maxFeatureVertices = features
            ? features.reduce(
              (max, feature) => Math.max(max, countVerticesFromGeometry(feature.geometry)),
              0,
            )
            : 0;
          const usePerFeatureIndex = layerVertexCount >= perFeatureVertexThreshold
            || maxFeatureVertices >= perFeatureMaxVertices;
          if (usePerFeatureIndex && features) {
            const perFeatureIndexStartedAt = Date.now();
            console.info('[vt] per-feature index enabled', JSON.stringify({
              ...taskContext,
              layerName,
              featureCount: features.length,
              layerVertexCount,
              maxFeatureVertices,
              perFeatureVertexThreshold,
              perFeatureMaxVertices,
            }));
            aggregatedLayersByTileId = new Map();
            const geojsonvt = await loadGeojsonVt();
            for (const feature of features) {
              assertNotAborted(abortSignal);
              const featureBox = featureBBox(feature);
              if (!featureBox) continue;
              for (let z = band.zMin; z <= band.zMax; z++) {
                assertNotAborted(abortSignal);
                const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
                for (let x = xStart; x <= xEnd; x++) {
                  assertNotAborted(abortSignal);
                  for (let y = yStart; y <= yEnd; y++) {
                    assertNotAborted(abortSignal);
                    const tileBBox = expandTileBBox(
                      tileToBBox(z, x, y),
                      vtConfig.bufferSize,
                      vtConfig.extent,
                    );
                    if (!bboxIntersects(featureBox, tileBBox)) continue;
                    const geometry = feature.geometry;
                    let clipped: Feature<Geometry> | null = null;
                    if (geometry && isClipGeometry(geometry)) {
                      clipped = geometryBboxClip(
                        feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
                        [tileBBox.minX, tileBBox.minY, tileBBox.maxX, tileBBox.maxY],
                      ) as Feature<Geometry>;
                    } else if (geometry && isPointGeometry(geometry)) {
                      if (isAnyPointInBBox(geometry, tileBBox)) {
                        clipped = feature as Feature<Geometry>;
                      }
                    }
                    if (!clipped || isEmptyGeometry(clipped.geometry)) continue;
                    const collection: FeatureCollection = { type: 'FeatureCollection', features: [clipped] };
                    const index = geojsonvt(collection, {
                      maxZoom: z,
                      indexMaxZoom: z,
                      extent: context.vtConfig.extent,
                      buffer: context.vtConfig.bufferSize,
                      tolerance: context.vtConfig.tolerance,
                      promoteId: context.vtConfig.promoteId,
                      indexMaxPoints: context.vtConfig.indexMaxPoints > 0 ? context.vtConfig.indexMaxPoints : undefined,
                    }) as GeojsonVtIndex;
                    const tile = collectLayerForTile(index, layerName, z, x, y);
                    if (!tile) continue;
                    const tileId = packTileId(x, y, z);
                    const existing = aggregatedLayersByTileId.get(tileId);
                    if (existing) {
                      mergeLayerTiles(existing, { [layerName]: tile });
                    } else {
                      aggregatedLayersByTileId.set(tileId, { [layerName]: tile });
                    }
                  }
                }
              }
            }
            console.info('[vt] per-feature index done', JSON.stringify({
              ...taskContext,
              layerName,
              tileCount: aggregatedLayersByTileId.size,
              duration: Date.now() - perFeatureIndexStartedAt,
              heap: getHeapSnapshot(),
            }));
            if (aggregatedLayersByTileId.size === 0) {
              console.warn('[vt] per-feature index produced no layers', JSON.stringify({
                ...taskContext,
                parentTile: parent,
                zRange: [band.zMin, band.zMax],
                layerName,
                featureCount: features.length,
                layerVertexCount,
                maxFeatureVertices,
              }));
              return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
            }
          } else {
            indexes = await buildLayerIndexes(context, layerMap, band, taskContext);
            if (indexes.size === 0) {
              return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
            }
          }
        } else {
          aggregatedLayersByTileId = new Map();
          for (const [layerName, features] of layerMap.entries()) {
            if (features.length === 0) continue;
            assertNotAborted(abortSignal);
            const singleLayerMap = new Map<string, Feature[]>([[layerName, features]]);
            const layerIndexes = await buildLayerIndexes(context, singleLayerMap, band, taskContext);
            const layerIndex = layerIndexes.get(layerName);
            if (!layerIndex) continue;
            for (let z = band.zMin; z <= band.zMax; z++) {
              assertNotAborted(abortSignal);
              const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
              for (let x = xStart; x <= xEnd; x++) {
                assertNotAborted(abortSignal);
                for (let y = yStart; y <= yEnd; y++) {
                  assertNotAborted(abortSignal);
                  const tile = collectLayerForTile(layerIndex, layerName, z, x, y);
                  if (!tile) continue;
                  const tileId = packTileId(x, y, z);
                  const existing = aggregatedLayersByTileId.get(tileId);
                  if (existing) {
                    mergeLayerTiles(existing, { [layerName]: tile });
                  } else {
                    aggregatedLayersByTileId.set(tileId, { [layerName]: tile });
                  }
                }
              }
            }
          }
          if (aggregatedLayersByTileId.size === 0) {
            console.warn('[vt] multi-layer index produced no layers', JSON.stringify({
              ...taskContext,
              parentTile: parent,
              zRange: [band.zMin, band.zMax],
              layerCount: layerMap.size,
            }));
            return { status: 'completed', message: buildSkippedMessage(adminFeatureSummary, tileSummary, 'no layers') };
          }
        }
      }

      let processedTiles = 0;
      let generatedTiles = 0;
      let lastReportAt = 0;
      let lastReported = -1;
      let lastMessage: string | null = null;
      const reportTileProgress = async (force: boolean, message?: string): Promise<void> => {
        const shouldReportMessage = Boolean(message && message !== lastMessage);
        if (!force && !shouldReportMessage && processedTiles === lastReported) return;
        const now = Date.now();
        if (!force && !shouldReportMessage && (now - lastReportAt < 500) && (processedTiles - lastReported < 25)) return;
        lastReportAt = now;
        lastReported = processedTiles;
        if (shouldReportMessage && message) {
          lastMessage = message;
        }
        const progress = totalTiles > 0
          ? Math.min(100, Math.max(0, Math.round((processedTiles / totalTiles) * 100)))
          : 0;
        try {
          await updateTask(taskQueue, task.taskId, {
            progress,
            ...(shouldReportMessage && message ? { message } : {}),
            outputData: {
              tilesGenerated: generatedTiles,
              totalTiles,
            },
          });
        } catch (error) {
          console.warn('[vt] failed to report tile progress', JSON.stringify({
            taskId: task.taskId,
            nodeId: String(task.nodeId),
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      };
      await reportTileProgress(true, `tiles 0/${totalTiles}`);

      const computeInputTileStats = (bbox: TileBBox) => {
        let featureCount = 0;
        let vertexCount = 0;
        let polygonCount = 0;
        let lineStringCount = 0;
        const bufferSet = new Set<string>();
        for (const stats of featureStats) {
          if (!bboxIntersects(stats.bbox, bbox)) continue;
          featureCount += 1;
          vertexCount += stats.vertexCount;
          polygonCount += stats.polygonCount;
          lineStringCount += stats.lineStringCount;
          bufferSet.add(stats.bufferId);
        }
        let inputBytes = 0;
        bufferSet.forEach((bufferId) => {
          inputBytes += bufferSizes.get(bufferId) ?? 0;
        });
        return { featureCount, vertexCount, polygonCount, lineStringCount, inputBytes };
      };

      const computeOutputTileStats = (layers: Record<string, Tile>) => {
        let featureCount = 0;
        let vertexCount = 0;
        let polygonCount = 0;
        let lineStringCount = 0;
        Object.values(layers).forEach((tile) => {
          const features = Array.isArray(tile.features) ? tile.features : [];
          featureCount += features.length;
          features.forEach((feature) => {
            if (feature.type === 3) {
              polygonCount += countTilePolygons(feature.geometry);
              vertexCount += countTileVertices(feature.geometry);
            } else if (feature.type === 2) {
              lineStringCount += countTileLineStrings(feature.geometry);
              vertexCount += countTileVertices(feature.geometry);
            } else {
              vertexCount += countTileVertices(feature.geometry);
            }
          });
        });
        return { featureCount, vertexCount, polygonCount, lineStringCount };
      };

      const tilingStartedAt = Date.now();
      const totalInputStats = {
        inputBytes: 0,
        featureCount: 0,
        polygonCount: 0,
        lineStringCount: 0,
        vertexCount: 0,
      };
      const totalOutputStats = {
        featureCount: 0,
        polygonCount: 0,
        lineStringCount: 0,
        vertexCount: 0,
      };
      const encodeStats = {
        tileCount: 0,
        bytes: 0,
        duration: 0,
      };
      const storeStats = {
        tileCount: 0,
        bytes: 0,
        duration: 0,
      };
      console.info('[vt] encode/store start', JSON.stringify({
        ...taskContext,
        totalTiles,
        bufferCount: input.bufferIds.length,
        heap: getHeapSnapshot(),
      }));
      for (let z = band.zMin; z <= band.zMax; z++) {
        assertNotAborted(abortSignal);
        const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
        for (let x = xStart; x <= xEnd; x++) {
          assertNotAborted(abortSignal);
          for (let y = yStart; y <= yEnd; y++) {
            assertNotAborted(abortSignal);
            const tileId = packTileId(x, y, z);
            const layers = aggregatedLayersByTileId
              ? (aggregatedLayersByTileId.get(tileId) ?? null)
              : (indexes ? collectLayersForTileFromIndexes(indexes, z, x, y) : null);
            processedTiles += 1;
            if (!layers) {
              await reportTileProgress(false);
              continue;
            }
            const tileBBox = tileToBBox(z, x, y);
            const inputStats = computeInputTileStats(
              expandTileBBox(tileBBox, vtConfig.bufferSize, vtConfig.extent),
            );
            const outputStats = computeOutputTileStats(layers);
            totalInputStats.inputBytes += inputStats.inputBytes;
            totalInputStats.featureCount += inputStats.featureCount;
            totalInputStats.polygonCount += inputStats.polygonCount;
            totalInputStats.lineStringCount += inputStats.lineStringCount;
            totalInputStats.vertexCount += inputStats.vertexCount;
            totalOutputStats.featureCount += outputStats.featureCount;
            totalOutputStats.polygonCount += outputStats.polygonCount;
            totalOutputStats.lineStringCount += outputStats.lineStringCount;
            totalOutputStats.vertexCount += outputStats.vertexCount;
            let bytes: Uint8Array;
            try {
              const encodeStartedAt = Date.now();
              bytes = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 }) as Uint8Array;
              encodeStats.duration += Date.now() - encodeStartedAt;
              encodeStats.tileCount += 1;
              encodeStats.bytes += bytes.byteLength;
            } catch (error) {
              console.error('[vt] failed to encode tile', JSON.stringify({
                ...taskContext,
                stage: 'encode',
                z,
                x,
                y,
                inputStats,
                outputStats,
                layerCount: Object.keys(layers).length,
                error: error instanceof Error ? error.message : String(error),
              }));
              throw error;
            }
            try {
              const storeStartedAt = Date.now();
              await tileWriter({
                tileId,
                z,
                x,
                y,
                bufferSetHash,
                data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
                layers,
              });
              storeStats.duration += Date.now() - storeStartedAt;
              storeStats.tileCount += 1;
              storeStats.bytes += bytes.byteLength;
            } catch (error) {
              console.error('[vt] tileWriter failed', JSON.stringify({
                ...taskContext,
                stage: 'tileWriter',
                z,
                x,
                y,
                tileId,
                bufferSetHash,
                inputStats,
                outputStats,
                byteLength: bytes.byteLength,
                error: error instanceof Error ? error.message : String(error),
              }));
              throw error;
            }
            generatedTiles += 1;
            const zoomCounts = tilesByZoom.get(z);
            if (zoomCounts) {
              zoomCounts.generated += 1;
            }
            const message = `tiles ${processedTiles}/${totalTiles} | tile z=${z} x=${x} y=${y} input(bytes=${inputStats.inputBytes}, features=${inputStats.featureCount}, polygons=${inputStats.polygonCount}, lines=${inputStats.lineStringCount}, vertices=${inputStats.vertexCount}) output(features=${outputStats.featureCount}, polygons=${outputStats.polygonCount}, lines=${outputStats.lineStringCount}, vertices=${outputStats.vertexCount})`;
            await reportTileProgress(false, message);
          }
        }
      }

      console.info('[vt] tiling done', JSON.stringify({
        ...taskContext,
        processedTiles,
        generatedTiles,
        totalTiles,
        inputTotals: totalInputStats,
        outputTotals: totalOutputStats,
        encodeStats,
        storeStats,
        duration: Date.now() - tilingStartedAt,
        heap: getHeapSnapshot(),
      }));
      const finalTileSummary = buildTileSummary(tilesByZoom);
      if (generatedTiles === 0) {
        console.warn('[vt] generated zero tiles', JSON.stringify({
          ...taskContext,
          parentTile: parent,
          zRange: [band.zMin, band.zMax],
          totalTiles,
          processedTiles,
          bufferCount: input.bufferIds.length,
          adminFeatureSummary,
          tileSummary: finalTileSummary,
        }));
        await reportTileProgress(true, buildSkippedMessage(adminFeatureSummary, finalTileSummary, 'no tiles'));
      } else {
        const summaryMessage = `${adminFeatureSummary}, ${finalTileSummary}`;
        await reportTileProgress(true, summaryMessage);
      }
      console.info('[vt] output tile totals', JSON.stringify({
        ...taskContext,
        generatedTiles,
        outputTotals: totalOutputStats,
      }));
      console.info('[vt] task completed', JSON.stringify({
        ...taskContext,
        processedTiles,
        generatedTiles,
        totalTiles,
        outputTotals: totalOutputStats,
        tilingDuration: Date.now() - tilingStartedAt,
        heap: getHeapSnapshot(),
      }));
      return {
        status: 'completed',
        progress: 100,
        message: generatedTiles === 0
          ? buildSkippedMessage(adminFeatureSummary, finalTileSummary, 'no tiles')
          : `${adminFeatureSummary}, ${finalTileSummary}`,
        outputData: {
          tilesGenerated: generatedTiles,
          totalTiles,
        },
      };
    } catch (error) {
      console.error('[vt] task failed', JSON.stringify({
        ...taskContext,
        stage: 'task',
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  };
};
