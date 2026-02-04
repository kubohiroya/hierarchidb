import type { TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Point, MultiPoint, Polygon, MultiPolygon } from 'geojson';
import type { Tile } from 'geojson-vt';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bboxClip as turfBboxClip } from '@turf/turf';
import {
  latToTileY,
  lonToTileX,
  pickAdminLevel,
  pickCountryCode,
  pickCountryName,
} from '@hierarchidb/gis-sdk';
import {
  buildZoomBandRanges,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import type { ShapeTileLayerInfo, ShapeVectorTileRecord } from '@hierarchidb/shape-api';
import { extractGeometryStats } from './featureMetadataUtils.ts';
import { buildStableSignature } from './taskSignatures.ts';
import { deleteTasksByIds, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeDB } from '@hierarchidb/shape-store';

export type ShapeTransformByBandTaskInput = {
  fetchCacheId: string;
  bandIndex: number;
  bandMinZoom?: number;
  bandMaxZoom?: number;
  domainType: 'shape';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  configSignature?: string;
};

export type ShapeVtTaskInput = {
  bandIndex: number;
  bandMinZoom: number;
  bandMaxZoom: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  featureCount: number;
  domainType: 'shape';
  sourceKey: string;
  configSignature?: string;
};

const HIGH_DETAIL_ZOOM_MIN = 9;

const buildTaskInputSignature = (input: unknown): string => (
  buildStableSignature(input ?? null)
);

export const filterObsoleteTasks = async (
  taskQueue: VtTaskQueueDb,
  existingTasks: TaskQueueRecord[],
  desiredTasks: TaskQueueRecord[],
): Promise<TaskQueueRecord[]> => {
  const desiredSignatures = new Map(
    desiredTasks.map((task) => [task.taskId, buildTaskInputSignature(task.inputData)] as const),
  );
  const obsoleteTaskIds: string[] = [];
  const validExistingTasks: TaskQueueRecord[] = [];
  existingTasks.forEach((task) => {
    const desiredSignature = desiredSignatures.get(task.taskId);
    if (!desiredSignature) {
      obsoleteTaskIds.push(task.taskId);
      return;
    }
    const existingSignature = buildTaskInputSignature(task.inputData);
    if (existingSignature !== desiredSignature) {
      obsoleteTaskIds.push(task.taskId);
      return;
    }
    validExistingTasks.push(task);
  });
  if (obsoleteTaskIds.length > 0) {
    await deleteTasksByIds(taskQueue, obsoleteTaskIds);
  }
  return validExistingTasks;
};

export const buildBands = (zoomBandBoundaries: number[]) => {
  const ranges = buildZoomBandRanges(zoomBandBoundaries, ZOOM_BAND_MIN_ZOOM, ZOOM_BAND_MAX_ZOOM);
  return ranges.map((range, index) => {
    const isLastRange = index === ranges.length - 1;
    const cappedMax = isLastRange ? range.max : Math.max(range.min, range.max - 1);
    return {
      bandIndex: index,
      zMin: range.min,
      zMax: cappedMax,
      zBase: range.min,
    };
  });
};

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    try {
      for await (const feature of decoded as AsyncIterable<Feature>) {
        features.push(feature);
      }
    } catch {
      return null;
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

export const decodeTransformCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded as unknown);
  } catch {
    return null;
  }
};

export const readNumericProperty = (properties: Record<string, unknown>, key: string): number | undefined => {
  const value = properties[key];
  if (typeof value !== 'number') return undefined;
  return Number.isFinite(value) ? value : undefined;
};

const ORIGIN_KEY_PROP = '__hdbOriginKey';

const parseOriginKey = (originKey: string): { countryCode?: string; adminLevel?: number } => {
  const index = originKey.indexOf(':');
  const sourceKey = index > 0 ? originKey.slice(index + 1) : originKey;
  const [countryCode, adminLevelRaw] = sourceKey.split(':');
  const adminLevel = adminLevelRaw != null ? Number(adminLevelRaw) : undefined;
  return {
    countryCode: countryCode?.trim().toUpperCase() || undefined,
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
  };
};

export const resolveFeatureOriginInfo = (
  properties: Record<string, unknown>,
  lookup?: Map<string, CountryMetadata>,
): { countryCode?: string; countryName?: string; adminLevel?: number } => {
  const originKey = typeof properties[ORIGIN_KEY_PROP] === 'string' ? properties[ORIGIN_KEY_PROP] as string : undefined;
  const originInfo = originKey ? parseOriginKey(originKey) : {};
  const rawCountryCode = originInfo.countryCode ?? pickCountryCode(properties);
  const rawAdminLevel = originInfo.adminLevel ?? pickAdminLevel(properties);
  const meta = rawCountryCode ? lookup?.get(rawCountryCode.trim().toUpperCase()) : undefined;
  const normalizedCode = (meta?.countryCode ?? meta?.iso2 ?? rawCountryCode)?.trim().toUpperCase();
  const normalizedName = meta?.countryName ?? pickCountryName(properties) ?? rawCountryCode;
  return {
    countryCode: normalizedCode,
    countryName: normalizedName,
    adminLevel: typeof rawAdminLevel === 'number' ? rawAdminLevel : undefined,
  };
};

export const describeBuffer = (buffer: ArrayBuffer): {
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

export const isTransformCacheComplete = (record: { timestamp: number } | null | undefined): record is { timestamp: number } => (
  Boolean(record && record.timestamp > 0)
);

// Keep in sync with @hierarchidb/vt-orchestrator tileId encoding.
const TILE_INDEX_BITS = 22;
const TILE_INDEX_SCALE = 2 ** TILE_INDEX_BITS;
const TILE_INDEX_STRIDE = TILE_INDEX_SCALE * TILE_INDEX_SCALE;

const packTileId = (x: number, y: number, z: number): number => (
  (z * TILE_INDEX_STRIDE) + (x * TILE_INDEX_SCALE) + y
);

const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);

const toDeg = (radians: number): number => radians * 180 / Math.PI;

const tileToBBox = (z: number, x: number, y: number): { minX: number; minY: number; maxX: number; maxY: number } => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

const isPointInBBox = (x: number, y: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => (
  x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
);

const isPointGeometry = (geometry: Geometry): geometry is Point => geometry.type === 'Point';

const isMultiPointGeometry = (geometry: Geometry): geometry is MultiPoint => geometry.type === 'MultiPoint';

const isAnyPointInBBox = (geometry: Geometry | null | undefined, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
  if (!geometry) return false;
  if (isPointGeometry(geometry)) {
    const [x, y] = geometry.coordinates ?? [];
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    return isPointInBBox(x, y, bbox);
  }
  if (isMultiPointGeometry(geometry)) {
    for (const point of geometry.coordinates) {
      const [x, y] = point ?? [];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (isPointInBBox(x, y, bbox)) return true;
    }
    return false;
  }
  return false;
};

const hasCoordinates = (coords: unknown): boolean => {
  if (!Array.isArray(coords)) return false;
  if (coords.length === 0) return false;
  if (typeof coords[0] === 'number') return true;
  return coords.some((entry) => hasCoordinates(entry));
};

const isLineOrPolygonFeature = (
  feature: Feature,
): feature is Feature<LineString | MultiLineString | Polygon | MultiPolygon> => {
  const type = feature.geometry?.type;
  return type === 'LineString'
    || type === 'MultiLineString'
    || type === 'Polygon'
    || type === 'MultiPolygon';
};

const featureIntersectsTileBBox = (feature: Feature, bbox: { minX: number; minY: number; maxX: number; maxY: number }): boolean => {
  if (isAnyPointInBBox(feature.geometry ?? null, bbox)) return true;
  if (!isLineOrPolygonFeature(feature)) return false;
  const clipped = turfBboxClip(
    feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
    [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY],
  ) as Feature<LineString | MultiLineString | Polygon | MultiPolygon> | null;
  return Boolean(clipped?.geometry && hasCoordinates(clipped.geometry.coordinates));
};

const collectTileIdsForCollection = (collection: FeatureCollection, zBase: number): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const bbox = extractGeometryStats(feature).bbox;
    if (!bbox) continue;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const x1Raw = lonToTileX(minLon, zBase);
    const x2Raw = lonToTileX(maxLon, zBase);
    const y1Raw = latToTileY(maxLat, zBase);
    const y2Raw = latToTileY(minLat, zBase);
    if (![x1Raw, x2Raw, y1Raw, y2Raw].every((value) => Number.isFinite(value))) continue;
    const x1 = clampTileIndex(x1Raw as number, maxIndex);
    const x2 = clampTileIndex(x2Raw as number, maxIndex);
    const y1 = clampTileIndex(y1Raw as number, maxIndex);
    const y2 = clampTileIndex(y2Raw as number, maxIndex);
    for (let x = x1; x <= x2; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
        const tileBBox = tileToBBox(zBase, x, y);
        if (!featureIntersectsTileBBox(feature, tileBBox)) continue;
        tileIds.add(packTileId(x, y, zBase));
      }
    }
  }
  return [...tileIds];
};

export const backfillTileRelationsFromTransformCache = async (params: {
  nodeId: NodeId;
  bandIndex: number;
  zBase: number;
  ephemeralStore: typeof ephemeralShapeDB;
}): Promise<{ relationCount: number; tileBuffers: Map<number, string[]> }> => {
  const { nodeId, bandIndex, zBase, ephemeralStore } = params;
  const buffers = await ephemeralStore.transaction('r', ephemeralStore.transformCache, async () => (
    ephemeralStore.transformCache
      .where('[nodeId+bandIndex]')
      .equals([nodeId, bandIndex])
      .toArray()
  ));
  const completedBuffers = buffers.filter((buffer) => isTransformCacheComplete(buffer));
  if (completedBuffers.length === 0) return { relationCount: 0, tileBuffers: new Map() };
  const createdAt = Date.now();
  const bufferIds = completedBuffers.map((buffer) => buffer.id);
  await ephemeralStore.tileIdToBufferRelations.where('bufferId').anyOf(bufferIds).delete();
  const pending: Array<{
    id: string;
    nodeId: NodeId;
    bandIndex: number;
    tileId: string;
    bufferId: string;
    createdAt: number;
  }> = [];
  const tileBuffers = new Map<number, string[]>();
  let written = 0;
  const flushPending = async () => {
    if (pending.length === 0) return;
    await ephemeralStore.tileIdToBufferRelations.bulkPut(pending);
    written += pending.length;
    pending.length = 0;
  };
  for (const buffer of completedBuffers) {
    const collection = await decodeTransformCache(buffer.data);
    if (!collection) {
      const debug = describeBuffer(buffer.data);
      console.warn('[shape-vt] failed to decode transform cache', {
        nodeId,
        bandIndex,
        bufferId: buffer.id,
        timestamp: buffer.timestamp,
        byteLength: debug.byteLength,
        headHex: debug.headHex,
        headAscii: debug.headAscii,
        jsonLike: debug.isJsonLike,
      });
      continue;
    }
    const tileIds = collectTileIdsForCollection(collection, zBase);
    if (tileIds.length === 0) continue;
    tileIds.forEach((tileId) => {
      const bucket = tileBuffers.get(tileId);
      if (bucket) {
        bucket.push(buffer.id);
      } else {
        tileBuffers.set(tileId, [buffer.id]);
      }
      pending.push({
        id: `${String(nodeId)}:${bandIndex}:${tileId}:${buffer.id}`,
        nodeId,
        bandIndex,
        tileId: String(tileId),
        bufferId: buffer.id,
        createdAt,
      });
    });
    if (pending.length >= 5000) {
      await flushPending();
    }
  }
  await flushPending();
  return { relationCount: written, tileBuffers };
};

export const hasHighDetailSelection = (
  selection?: SelectedArrayByCountries,
  payloads?: FetchTaskPayload[],
): boolean => {
  if (payloads?.some((payload) => payload.adminLevel >= 2)) return true;
  if (!selection) return false;
  return Object.values(selection).some((row) => row?.some((selected, index) => selected && index >= 2));
};

export const buildTransformByBandTasks = async (
  nodeId: NodeId,
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>,
  enableHighDetailBands: boolean,
  countryLookup: Map<string, CountryMetadata>,
  configSignature: string,
): Promise<Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>> => {
  const buffers = await ephemeralShapeDB.fetchCache.where('nodeId').equals(nodeId).toArray();
  const tasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
  let index = 0;

  for (const buffer of buffers) {
    if (buffer.featureCount === 0) {
      continue;
    }
    const adminLevel = buffer.adminLevel;
    const stagePriority = typeof adminLevel === 'number' ? adminLevel : 0;
    const countryCode = buffer.countryCode?.trim().toUpperCase();
    const countryMeta = countryCode ? countryLookup.get(countryCode) : undefined;
    for (const band of bands) {
      if (band.zMin >= HIGH_DETAIL_ZOOM_MIN) {
        if (!enableHighDetailBands) continue;
        if (typeof adminLevel !== 'number' || adminLevel < 2) continue;
      }
      tasks.push({
        taskId: `${String(nodeId)}:transform:${band.bandIndex}:${buffer.sourceKey}`,
        nodeId,
        stage: 'transform',
        status: 'queued',
        index,
        stagePriority,
        progress: 0,
        inputData: {
          fetchCacheId: buffer.id,
          bandIndex: band.bandIndex,
          bandMinZoom: band.zMin,
          bandMaxZoom: band.zMax,
          domainType: 'shape',
          sourceKey: buffer.sourceKey,
          stagePriority,
          countryCode,
          countryName: countryMeta?.countryName,
          adminLevel: buffer.adminLevel,
          configSignature,
        },
      });
      index += 1;
    }
  }
  return tasks;
};

export const buildCountryLookup = (metadata: CountryMetadata[]): Map<string, CountryMetadata> => {
  const map = new Map<string, CountryMetadata>();
  metadata.forEach((entry) => {
    const iso2 = entry.iso2?.trim().toUpperCase() ?? entry.countryCode?.trim().toUpperCase();
    const iso3 = entry.iso3?.trim().toUpperCase();
    if (iso2) map.set(iso2, entry);
    if (iso3) map.set(iso3, entry);
    if (entry.countryCode) map.set(entry.countryCode.trim().toUpperCase(), entry);
  });
  return map;
};

export const buildContinentLookup = (metadata: CountryMetadata[]): Map<string, string> => {
  const map = new Map<string, string>();
  metadata.forEach((entry) => {
    const continent = entry.continent?.trim();
    if (!continent) return;
    const iso2 = entry.iso2?.trim().toUpperCase() ?? entry.countryCode?.trim().toUpperCase();
    const iso3 = entry.iso3?.trim().toUpperCase();
    if (iso2) map.set(iso2, continent);
    if (iso3) map.set(iso3, continent);
    if (entry.countryCode) map.set(entry.countryCode.trim().toUpperCase(), continent);
  });
  return map;
};

const listTransformCacheIdsByTile = async (
  store: typeof ephemeralShapeDB,
  nodeId: NodeId,
  bandIndex: number,
  tileId: number,
): Promise<string[]> => {
  const rows = await store.tileIdToBufferRelations
    .where('[nodeId+bandIndex+tileId]')
    .equals([nodeId, bandIndex, String(tileId)])
    .toArray();
  return rows.map((row) => row.bufferId);
};

export const buildVtTasks = async (
  nodeId: NodeId,
  ephemeralStore: typeof ephemeralShapeDB,
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>,
  enableHighDetailBands: boolean,
  configSignature: string,
): Promise<Array<TaskQueueRecord<ShapeVtTaskInput>>> => {
  const tasks: Array<TaskQueueRecord<ShapeVtTaskInput>> = [];
  let index = 0;

  for (const band of bands) {
    const isHighDetailBand = band.zMin >= HIGH_DETAIL_ZOOM_MIN;
    if (isHighDetailBand && !enableHighDetailBands) continue;
    const tileBuffers = new Map<number, string[]>();
    let relationCount = 0;
    const buildTileBuffers = async () => {
      await ephemeralStore.tileIdToBufferRelations
        .where('[nodeId+bandIndex]')
        .equals([nodeId, band.bandIndex])
        .each((row) => {
          relationCount += 1;
          const tileId = Number(row.tileId);
          if (!Number.isFinite(tileId)) return;
          const bucket = tileBuffers.get(tileId);
          if (bucket) {
            bucket.push(row.bufferId);
          } else {
            tileBuffers.set(tileId, [row.bufferId]);
          }
        });
    };
    await buildTileBuffers();
    if (relationCount === 0) {
      const backfilled = await backfillTileRelationsFromTransformCache({
        nodeId,
        bandIndex: band.bandIndex,
        zBase: band.zBase,
        ephemeralStore,
      });
      relationCount = backfilled.relationCount;
      if (relationCount > 0) {
        tileBuffers.clear();
        backfilled.tileBuffers.forEach((value, key) => {
          tileBuffers.set(key, value);
        });
        console.warn('[shape-vt] rebuilt missing tile relations', {
          nodeId,
          bandIndex: band.bandIndex,
          relationCount,
        });
      }
    }
    console.info('[shape-vt] tile relation snapshot', {
      nodeId,
      bandIndex: band.bandIndex,
      zBase: band.zBase,
      relationCount,
      tileCount: tileBuffers.size,
      tileSample: [...tileBuffers.keys()].slice(0, 5),
    });
    const tileIds = [...tileBuffers.keys()];
    for (const tileId of tileIds) {
      const bufferIds = tileBuffers.get(tileId)
        ?? await listTransformCacheIdsByTile(ephemeralStore, nodeId, band.bandIndex, tileId);
      if (bufferIds.length === 0) continue;
      const buffers = await ephemeralStore.transaction('r', ephemeralStore.transformCache, async () => (
        ephemeralStore.transformCache.where('id').anyOf(bufferIds).toArray()
      ));
      const completedBuffers = buffers.filter((buffer) => isTransformCacheComplete(buffer));
      if (completedBuffers.length === 0) continue;
      const completedBufferIds = new Set(completedBuffers.map((buffer) => buffer.id));
      const usableBufferIds = bufferIds.filter((bufferId) => completedBufferIds.has(bufferId));
      if (usableBufferIds.length === 0) continue;
      const featureById = new Map(completedBuffers.map((buffer) => [buffer.id, buffer.featureCount] as const));
      const featureCount = usableBufferIds.reduce((sum, bufferId) => sum + (featureById.get(bufferId) ?? 0), 0);
      tasks.push({
        taskId: `${String(nodeId)}:vt:${band.bandIndex}:${band.zBase}:${tileId}`,
        nodeId,
        stage: 'vt',
        status: 'queued',
        index,
        progress: 0,
        inputData: {
          bandIndex: band.bandIndex,
          bandMinZoom: band.zMin,
          bandMaxZoom: band.zMax,
          zBase: band.zBase,
          tileId,
          bufferIds: usableBufferIds,
          featureCount,
          domainType: 'shape',
          sourceKey: 'mixed',
          configSignature,
        },
      });
      index += 1;
    }
  }

  return tasks;
};

export const resolveTransformConfig = (config: ShapeBuildConfig) => config.transformConfig;

export const resolveVtConfig = (config: ShapeBuildConfig) => config.vtConfig;

const buildTileLayerInfo = (layers: Record<string, Tile>, z: number): ShapeTileLayerInfo[] => (
  Object.entries(layers).map(([name, tile]) => ({
    name,
    featureCount: Array.isArray(tile.features) ? tile.features.length : 0,
    minZoom: typeof tile.z === 'number' ? tile.z : z,
    maxZoom: typeof tile.z === 'number' ? tile.z : z,
    fields: [],
  }))
);

export const buildShapeVectorTileRecord = (params: {
  nodeId: NodeId;
  tileId: number;
  z: number;
  x: number;
  y: number;
  bufferSetHash: string;
  data: ArrayBuffer;
  layers: Record<string, Tile>;
}): ShapeVectorTileRecord => {
  const bytes = new Uint8Array(params.data);
  const features = Object.values(params.layers).reduce((sum, tile) => (
    sum + (Array.isArray(tile.features) ? tile.features.length : 0)
  ), 0);
  return {
    tileId: `${params.tileId}|${params.bufferSetHash}`,
    nodeId: params.nodeId,
    z: params.z,
    x: params.x,
    y: params.y,
    data_Uint8Array: bytes,
    size: bytes.byteLength,
    features,
    layers: buildTileLayerInfo(params.layers, params.z),
    generatedAt: Date.now(),
    contentHash: params.bufferSetHash,
    version: 1,
  };
};
