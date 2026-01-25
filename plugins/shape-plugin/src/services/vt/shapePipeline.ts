import type { BuildContinuationPolicy, NodeId, StageHandler, TaskQueueRecord } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Point, MultiPoint, Polygon, MultiPolygon } from 'geojson';
import type { Tile } from 'geojson-vt';
import { buildFeatureId, extractGeometryStats } from './featureMetadataUtils.ts';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { ShapeFeatureMetadata, ShapeVectorTileRecord, ShapeTileLayerInfo } from '@hierarchidb/plugin-service-api';
import { bboxClip as turfBboxClip } from '@turf/turf';
import {
  latToTileY,
  lonToTileX,
  pickAdminCode,
  pickAdminLevel,
  pickAdminName,
  pickCountryCode,
  pickCountryName,
} from '@hierarchidb/gis-sdk';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  deleteTasksByIds,
  listTasksByStage,
  listTasksByStageAndStatus,
  putTasks,
  runStageTasks,
  updateTask,
  createTransformByBandHandler,
  createVtHandler,
} from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';
import type { CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { runShapeFetchStage } from './shapeFetchStage.js';
import { updateShapeStageMetadata } from './shapeStageMetadata.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import { deleteRawDataDataSourceBuffersForNode } from '../utils/chunkStore.js';
import { buildStableSignature } from './taskSignatures.ts';
import {
  buildZoomBandRanges,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_ZOOM,
} from '../../common/config/zoomBands.js';

export type ShapeTransformByBandTaskInput = {
  fetchCacheId: string;
  bandId: number;
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

type ShapeVtTaskInput = {
  bandId: number;
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

const filterObsoleteTasks = async (
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

const buildBands = (zoomBandBoundaries: number[]) => {
  const ranges = buildZoomBandRanges(zoomBandBoundaries, ZOOM_BAND_MIN_ZOOM, ZOOM_BAND_MAX_ZOOM);
  return ranges.map((range, index) => {
    const isLastRange = index === ranges.length - 1;
    const cappedMax = isLastRange ? range.max : Math.max(range.min, range.max - 1);
    return {
      bandId: index,
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

const decodeTransformCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded as unknown);
  } catch {
    return null;
  }
};


const readNumericProperty = (properties: Record<string, unknown>, key: string): number | undefined => {
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

const resolveFeatureOriginInfo = (
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

const buildFeatureMetadataFromTransformCaches = async (
  nodeId: NodeId,
  dataSource: DataSourceName,
  ephemeralStore: typeof ephemeralShapeDB,
): Promise<ShapeFeatureMetadata[]> => {
  const records: ShapeFeatureMetadata[] = [];
  const createdAt = Date.now();
  const metadata = await metadataLoader.loadMetadata(dataSource, nodeId);
  const countryLookup = buildCountryLookup(metadata);
  const buffers = await ephemeralStore.transformCache.where('nodeId').equals(nodeId).toArray();
  for (const buffer of buffers) {
    if (!isTransformCacheComplete(buffer)) continue;
    const collection = await decodeTransformCache(buffer.data);
    if (!collection) continue;
    for (let index = 0; index < collection.features.length; index += 1) {
      const feature = collection.features[index];
      if (!feature) continue;
      feature.properties = feature.properties ?? {};
      const properties = feature.properties as Record<string, unknown>;
      const originInfo = resolveFeatureOriginInfo(properties, countryLookup);
      const countryCode = originInfo.countryCode;
      const adminLevel = originInfo.adminLevel;
      const adminCode = pickAdminCode(properties);
      const featureId = buildFeatureId(feature, index, { countryCode, adminLevel, adminCode });
      const stats = extractGeometryStats(feature);
      const fetchVertexCount = readNumericProperty(properties, '__hdbFetchVertexCount');
      const fetchPolygonCount = readNumericProperty(properties, '__hdbFetchPolygonCount');
      records.push({
        id: `${String(nodeId)}-${featureId}`,
        nodeId: String(nodeId),
        featureId,
        countryName: originInfo.countryName,
        countryCode,
        adminName: pickAdminName(properties),
        adminLevel,
        adminCode,
        dataSource,
        createdAt,
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        fetchVertexCount,
        fetchPolygonCount,
        transformVertexCount: stats.vertexCount,
        transformPolygonCount: stats.polygonCount,
        bbox: stats.bbox,
        area: stats.area,
      });
    }
  }
  return records;
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

const isTransformCacheComplete = (record: { timestamp: number } | null | undefined): record is { timestamp: number } => (
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

const backfillTileRelationsFromTransformCache = async (params: {
  nodeId: NodeId;
  bandId: number;
  zBase: number;
  ephemeralStore: typeof ephemeralShapeDB;
}): Promise<{ relationCount: number; tileBuffers: Map<number, string[]> }> => {
  const { nodeId, bandId, zBase, ephemeralStore } = params;
  const buffers = await ephemeralStore.transaction('r', ephemeralStore.transformCache, async () => (
    ephemeralStore.transformCache
      .where('[nodeId+bandId]')
      .equals([nodeId, bandId])
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
    bandId: number;
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
        bandId,
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
        id: `${String(nodeId)}:${bandId}:${tileId}:${buffer.id}`,
        nodeId,
        bandId,
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

const hasHighDetailSelection = (
  selection?: SelectedArrayByCountries,
  payloads?: FetchTaskPayload[],
): boolean => {
  if (payloads?.some((payload) => payload.adminLevel >= 2)) return true;
  if (!selection) return false;
  return Object.values(selection).some((row) => row?.some((selected, index) => selected && index >= 2));
};

const buildTransformByBandTasks = async (
  nodeId: NodeId,
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>,
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
        taskId: `${String(nodeId)}:transform:${band.bandId}:${buffer.sourceKey}`,
        nodeId,
        stage: 'transform',
        status: 'queued',
        index,
        stagePriority,
        progress: 0,
        inputData: {
          fetchCacheId: buffer.id,
          bandId: band.bandId,
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

const buildCountryLookup = (metadata: CountryMetadata[]): Map<string, CountryMetadata> => {
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

const buildContinentLookup = (metadata: CountryMetadata[]): Map<string, string> => {
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
  bandId: number,
  tileId: number,
): Promise<string[]> => {
  const rows = await store.tileIdToBufferRelations
    .where('[nodeId+bandId+tileId]')
    .equals([nodeId, bandId, String(tileId)])
    .toArray();
  return rows.map((row) => row.bufferId);
};

const buildVtTasks = async (
  nodeId: NodeId,
  ephemeralStore: typeof ephemeralShapeDB,
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>,
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
        .where('[nodeId+bandId]')
        .equals([nodeId, band.bandId])
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
        bandId: band.bandId,
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
          bandId: band.bandId,
          relationCount,
        });
      }
    }
    console.info('[shape-vt] tile relation snapshot', {
      nodeId,
      bandId: band.bandId,
      zBase: band.zBase,
      relationCount,
      tileCount: tileBuffers.size,
      tileSample: [...tileBuffers.keys()].slice(0, 5),
    });
    const tileIds = [...tileBuffers.keys()];
    for (const tileId of tileIds) {
      const bufferIds = tileBuffers.get(tileId)
        ?? await listTransformCacheIdsByTile(ephemeralStore, nodeId, band.bandId, tileId);
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
        taskId: `${String(nodeId)}:vt:${band.bandId}:${band.zBase}:${tileId}`,
        nodeId,
        stage: 'vt',
        status: 'queued',
        index,
        progress: 0,
        inputData: {
          bandId: band.bandId,
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

const resolveTransformConfig = (config: ShapeBuildConfig) => config.transformConfig;

const resolveVtConfig = (config: ShapeBuildConfig) => config.vtConfig;

const buildTileLayerInfo = (layers: Record<string, Tile>, z: number): ShapeTileLayerInfo[] => (
  Object.entries(layers).map(([name, tile]) => ({
    name,
    featureCount: Array.isArray(tile.features) ? tile.features.length : 0,
    minZoom: typeof tile.z === 'number' ? tile.z : z,
    maxZoom: typeof tile.z === 'number' ? tile.z : z,
    fields: [],
  }))
);

const buildShapeVectorTileRecord = (params: {
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

export type ShapePipelineParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  buildConfig: ShapeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  pipelineRunId?: string;
};

const resolveFailureHandling = (policy: BuildContinuationPolicy): 'continue' | 'stop' => (
  policy === 'stop_on_first_error' ? 'stop' : 'continue'
);

const shouldStopAfterStage = (policy: BuildContinuationPolicy, failedCount: number): boolean => (
  failedCount > 0 && policy !== 'finish_all_stages'
);

const getFailedTaskCount = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<number> => {
  const failed = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'failed');
  return failed.length;
};

const summarizeStageCounts = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<Record<string, number>> => {
  const [queued, running, completed, failed] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'queued'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'completed'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'failed'),
  ]);
  return {
    queued: queued.length,
    running: running.length,
    completed: completed.length,
    failed: failed.length,
  };
};

const readHeapSnapshot = () => {
  const performance = (globalThis as {
    performance?: {
      memory?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
      };
    };
  }).performance;
  const memory = performance?.memory;
  if (!memory) return null;
  return {
    used: memory.usedJSHeapSize ?? null,
    total: memory.totalJSHeapSize ?? null,
    limit: memory.jsHeapSizeLimit ?? null,
  };
};

const resetStageRunningTasks = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<void> => {
  const runningTasks = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running');
  if (runningTasks.length === 0) return;
  console.warn('[ShapePipeline] resetting stale running tasks', {
    nodeId,
    stage,
    count: runningTasks.length,
  });
  await Promise.all(runningTasks.map((task) => updateTask(taskQueue, task.taskId, {
    status: 'queued',
    progress: 0,
    startedAt: undefined,
    completedAt: undefined,
    errorMessage: undefined,
    message: undefined,
    outputData: undefined,
  })));
};

export const runShapePipeline = async (params: ShapePipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const ephemeralStore = ephemeralShapeDB;
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
  const failureHandling = resolveFailureHandling(buildContinuationPolicy);
  let stopAfterStage = false;
  let metadataCache: CountryMetadata[] | null = null;
  let countryLookup: Map<string, CountryMetadata> | null = null;
  let continentLookup: Map<string, string> | null = null;
  console.warn('[ShapePipeline] run start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks,
    buildContinuationPolicy,
  }));
  if (!resumeExistingTasks) {
    await deleteTasksByNode(taskQueue, params.nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(params.nodeId);
  }

  const enableHighDetailBands = hasHighDetailSelection(
    params.selectedArrayByCountries,
    params.downloadTaskPayloads,
  );
  const bands = buildBands(params.buildConfig.transformConfig.zoomBandBoundaries);
  const loadMetadata = async (): Promise<CountryMetadata[]> => {
    if (metadataCache) return metadataCache;
    metadataCache = await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
    return metadataCache;
  };
  const loadCountryLookup = async (): Promise<Map<string, CountryMetadata>> => {
    if (countryLookup) return countryLookup;
    countryLookup = buildCountryLookup(await loadMetadata());
    return countryLookup;
  };
  const loadContinentLookup = async (): Promise<Map<string, string>> => {
    if (continentLookup) return continentLookup;
    continentLookup = buildContinentLookup(await loadMetadata());
    return continentLookup;
  };

  const fetchAbortController = new AbortController();
  await runShapeFetchStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    selectedArrayByCountries: params.selectedArrayByCountries,
    downloadTaskPayloads: params.downloadTaskPayloads,
    buildConfig: params.buildConfig,
    taskQueue,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    abortController: fetchAbortController,
    failureHandling,
  });
  console.warn('[ShapeTransform][PipelineDiagnostics] stage fetch completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: await summarizeStageCounts(taskQueue, params.nodeId, 'fetch'),
  }));
  const [queuedFetchTasks, runningFetchTasks] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, params.nodeId, 'fetch', 'queued'),
    listTasksByStageAndStatus(taskQueue, params.nodeId, 'fetch', 'running'),
  ]);
  if (queuedFetchTasks.length > 0 || runningFetchTasks.length > 0) {
    const now = Date.now();
    await Promise.all(
      [...queuedFetchTasks, ...runningFetchTasks].map((task) => (
        updateTask(taskQueue, task.taskId, {
          status: 'failed',
          errorMessage: 'aborted: fetch stage completed with pending tasks',
          completedAt: now,
        })
      )),
    );
    console.warn('[ShapeFetch][PipelineDiagnostics] fetch stage finalized pending tasks', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      queued: queuedFetchTasks.length,
      running: runningFetchTasks.length,
    }));
  }
  if (shouldStopAfterStage(buildContinuationPolicy, await getFailedTaskCount(taskQueue, params.nodeId, 'fetch'))) {
    stopAfterStage = true;
  }

  if (!stopAfterStage) {
    let existingTransformByBandTasks = resumeExistingTasks
      ? await listTasksByStage(taskQueue, params.nodeId, 'transform')
      : [];
    const transformConfigSignature = buildStableSignature(resolveTransformConfig(params.buildConfig));
    const desiredTransformTasks = await buildTransformByBandTasks(
      params.nodeId,
      bands,
      enableHighDetailBands,
      await loadCountryLookup(),
      transformConfigSignature,
    );
    if (resumeExistingTasks && existingTransformByBandTasks.length > 0) {
      existingTransformByBandTasks = await filterObsoleteTasks(
        taskQueue,
        existingTransformByBandTasks,
        desiredTransformTasks,
      );
    }
    let missingTransformTasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
    if (resumeExistingTasks) {
      const existingIds = new Set(existingTransformByBandTasks.map((task) => task.taskId));
      missingTransformTasks = desiredTransformTasks.filter((task) => !existingIds.has(task.taskId)) as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
      if (missingTransformTasks.length > 0) {
        await putTasks(taskQueue, missingTransformTasks);
      }
    } else {
      missingTransformTasks = desiredTransformTasks as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
      if (missingTransformTasks.length > 0) {
        await putTasks(taskQueue, missingTransformTasks);
      }
    }
    if (existingTransformByBandTasks.length > 0 || missingTransformTasks.length > 0) {
      await params.waitIfPaused?.();
      await resetStageRunningTasks(taskQueue, params.nodeId, 'transform');
      const transformByBandAbortController = new AbortController();
      const transformByBandHandler = createTransformByBandHandler({
        ephemeralDB: ephemeralStore,
        transformConfig: resolveTransformConfig(params.buildConfig),
        bands,
        abortSignal: transformByBandAbortController.signal,
      });
      await runStageTasks({
        nodeId: params.nodeId,
        stage: 'transform',
        handler: transformByBandHandler as unknown as StageHandler<ShapeTransformByBandTaskInput>,
        waitIfPaused: params.waitIfPaused,
        maxConcurrent: params.buildConfig.transformConfig.maxConcurrent,
        failureHandling,
        abortController: transformByBandAbortController,
      });
      console.warn('[ShapeTransform][PipelineDiagnostics] stage transform completed', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        counts: await summarizeStageCounts(taskQueue, params.nodeId, 'transform'),
      }));
      const [queuedTransformTasks, runningTransformTasks] = await Promise.all([
        listTasksByStageAndStatus(taskQueue, params.nodeId, 'transform', 'queued'),
        listTasksByStageAndStatus(taskQueue, params.nodeId, 'transform', 'running'),
      ]);
      if (queuedTransformTasks.length > 0 || runningTransformTasks.length > 0) {
        const now = Date.now();
        await Promise.all(
          [...queuedTransformTasks, ...runningTransformTasks].map((task) => (
            updateTask(taskQueue, task.taskId, {
              status: 'failed',
              errorMessage: 'aborted: transform stage completed with pending tasks',
              completedAt: now,
            })
          )),
        );
        console.warn('[ShapeTransform][PipelineDiagnostics] transform stage finalized pending tasks', JSON.stringify({
          nodeId: params.nodeId,
          runId: params.pipelineRunId ?? null,
          queued: queuedTransformTasks.length,
          running: runningTransformTasks.length,
        }));
      }
      if (shouldStopAfterStage(buildContinuationPolicy, await getFailedTaskCount(taskQueue, params.nodeId, 'transform'))) {
        stopAfterStage = true;
      }
      if (params.buildConfig.fetchConfig.deleteOnComplete) {
        await ephemeralStore.fetchCache.where('nodeId').equals(params.nodeId).delete();
      }
    }
  }

  if (!stopAfterStage) {
    const vtConfig = resolveVtConfig(params.buildConfig);
    let existingVtTasks = resumeExistingTasks
      ? await listTasksByStage(taskQueue, params.nodeId, 'vt')
      : [];
    const vtConfigSignature = buildStableSignature(vtConfig);
    const desiredVtTasks = await buildVtTasks(
      params.nodeId,
      ephemeralStore,
      bands,
      enableHighDetailBands,
      vtConfigSignature,
    );
    if (resumeExistingTasks && existingVtTasks.length > 0) {
      existingVtTasks = await filterObsoleteTasks(taskQueue, existingVtTasks, desiredVtTasks);
    }
    if (resumeExistingTasks && existingVtTasks.length > 0) {
      const runningVtTasks = await listTasksByStageAndStatus(taskQueue, params.nodeId, 'vt', 'running');
      if (runningVtTasks.length > 0) {
        await Promise.all(runningVtTasks.map((task) => (
          updateTask(taskQueue, task.taskId, {
            status: 'failed',
            errorMessage: 'aborted: resume cleared running vt task',
            completedAt: Date.now(),
          })
        )));
      }
    }
    let missingVtTasks: Array<TaskQueueRecord<ShapeVtTaskInput>> = [];
    if (resumeExistingTasks) {
      const existingIds = new Set(existingVtTasks.map((task) => task.taskId));
      missingVtTasks = desiredVtTasks.filter((task) => !existingIds.has(task.taskId)) as Array<TaskQueueRecord<ShapeVtTaskInput>>;
      if (missingVtTasks.length > 0) {
        await putTasks(taskQueue, missingVtTasks);
      }
    } else {
      missingVtTasks = desiredVtTasks as Array<TaskQueueRecord<ShapeVtTaskInput>>;
      if (missingVtTasks.length > 0) {
        await putTasks(taskQueue, missingVtTasks);
      }
    }
    console.warn('[ShapeVt][PipelineMetrics] vt task prep', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      existingTaskCount: existingVtTasks.length,
      newTaskCount: missingVtTasks.length,
    }));
    if (existingVtTasks.length > 0 || missingVtTasks.length > 0) {
      await params.waitIfPaused?.();
      console.warn('[ShapeVt][PipelineMetrics] vt queue snapshot', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        counts: await summarizeStageCounts(taskQueue, params.nodeId, 'vt'),
      }));
      console.warn('[ShapeVt][PipelineMetrics] stage vt start', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        bands: bands.length,
        heap: readHeapSnapshot(),
      }));
      const vtAbortController = new AbortController();
      const continentByCountry = bands.some((band) => band.zMin === 0)
        ? await loadContinentLookup()
        : undefined;
      const vtHandler = createVtHandler({
        ephemeralDB: ephemeralStore,
        vtConfig,
        bands,
        abortSignal: vtAbortController.signal,
        continentByCountry,
        tileWriter: async ({ tileId, z, x, y, data, layers, bufferSetHash }) => {
          await shapeMutationAPIImpl.storeVectorTile(buildShapeVectorTileRecord({
            nodeId: params.nodeId,
            tileId,
            z,
            x,
            y,
            bufferSetHash,
            data,
            layers,
          }));
        },
      });
      await runStageTasks({
        nodeId: params.nodeId,
        stage: 'vt',
        handler: vtHandler as unknown as StageHandler<ShapeVtTaskInput>,
        waitIfPaused: params.waitIfPaused,
        maxConcurrent: vtConfig.maxConcurrent,
        dynamicConcurrency: vtConfig.dynamicConcurrency?.enabled
          ? {
            ...vtConfig.dynamicConcurrency,
            maxConcurrent: vtConfig.dynamicConcurrency.maxConcurrent ?? vtConfig.maxConcurrent,
          }
          : undefined,
        failureHandling,
        abortController: vtAbortController,
      });
      const [queuedVtTasks, runningVtTasks] = await Promise.all([
        listTasksByStageAndStatus(taskQueue, params.nodeId, 'vt', 'queued'),
        listTasksByStageAndStatus(taskQueue, params.nodeId, 'vt', 'running'),
      ]);
      if (queuedVtTasks.length > 0 || runningVtTasks.length > 0) {
        const now = Date.now();
        await Promise.all(
          [...queuedVtTasks, ...runningVtTasks].map((task) => (
            updateTask(taskQueue, task.taskId, {
              status: 'failed',
              errorMessage: 'aborted: vt stage completed with pending tasks',
              completedAt: now,
            })
          )),
        );
        console.warn('[ShapeVt][PipelineDiagnostics] vt stage finalized pending tasks', JSON.stringify({
          nodeId: params.nodeId,
          runId: params.pipelineRunId ?? null,
          queued: queuedVtTasks.length,
          running: runningVtTasks.length,
        }));
      }
      console.warn('[ShapeVt][PipelineMetrics] stage vt done', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        heap: readHeapSnapshot(),
      }));
      console.warn('[ShapeTransform][PipelineDiagnostics] stage vt completed', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        counts: await summarizeStageCounts(taskQueue, params.nodeId, 'vt'),
      }));
      if (params.buildConfig.transformConfig.deleteOnComplete) {
        await ephemeralStore.transaction('rw', ephemeralStore.transformCache, async () => {
          await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
        });
      }
    }
  }

  const featureMetadataRows = await buildFeatureMetadataFromTransformCaches(
    params.nodeId,
    params.dataSource,
    ephemeralStore,
  );
  if (featureMetadataRows.length > 0) {
    await shapeMutationAPIImpl.putFeatureMetadata(featureMetadataRows);
  }

  await updateShapeStageMetadata({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    shapeStore: ephemeralStore,
    shapeDb: shapeDB,
  });

  const cleanupConfig = params.buildConfig.cleanupConfig;
  if (cleanupConfig?.deleteFetchFilteredCache) {
    await ephemeralStore.fetchCache
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
  }
  if (cleanupConfig?.deleteFetchApiCache) {
    await deleteRawDataDataSourceBuffersForNode(params.nodeId);
  }
  if (cleanupConfig?.deleteTransformCache) {
    await ephemeralStore.transaction('rw', ephemeralStore.transformCache, async () => {
      await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
    });
  }
  if (cleanupConfig?.deleteVTCache) {
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
