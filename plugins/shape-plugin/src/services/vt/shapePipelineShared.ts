import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString, Point, MultiPoint, Polygon, MultiPolygon } from 'geojson';
import type { Tile } from 'geojson-vt';
import { geojson as geojsonApi } from 'flatgeobuf';
import {
  geometryBboxClip,
  latToTileY,
  lonToTileX,
  pickAdminLevel,
  pickCountryCode,
  pickCountryName,
  type GeometryEngine,
} from '@hierarchidb/gis-sdk';
import {
  buildZoomBandRanges,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import type { CountryMetadata, SourceTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import type { ShapeTileLayerInfo, ShapeVectorTileRecord } from '@hierarchidb/shape-api';
import { extractGeometryStats } from './featureMetadataUtils.ts';
import { buildStableSignature } from './buildStableSignature.ts';
import { deleteTasksByIds, type VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { ephemeralDB, type EphemeralDB } from '@hierarchidb/gis-sdk';
import {
  buildGeometryTaskCacheIdentity,
  buildTileEmitTaskCacheIdentity,
  requireShapeSourceBaseTolerance,
} from './shapeTaskCacheIdentity.ts';
import { resolveSourceArtifactHashFromRecord } from './shapeSourceArtifactHashUtils.ts';

export type ShapeGeometryByBandTaskInput = {
  sourceCacheId: string;
  sourceArtifactHash: string;
  sourceCacheFormat?: 'flatgeobuf' | 'topojson';
  sourceCacheCompression?: 'gzip' | 'none';
  bandIndex: number;
  bandMinZoom: number;
  bandMaxZoom: number;
  sourceBaseTolerance: number;
  inputVertexCount?: number;
  inputPolygonCount?: number;
  domainType: 'shape';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  dataSource?: string;
  sourceUrl?: string;
  sourceCountryCode?: string;
  sourceFeatureInputCount?: number;
  sourceFeatureOutputCount?: number;
  sourcePolygonInputCount?: number;
  sourcePolygonOutputCount?: number;
  configSignature: string;
  cacheKey: string;
  inputHash: string;
};

export type ShapeTileEmitTaskInput = {
  bandIndex: number;
  bandMinZoom: number;
  bandMaxZoom: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  featureCount: number;
  domainType: 'shape';
  sourceKey: string;
  configSignature: string;
  cacheKey: string;
  inputHash: string;
};

const HIGH_DETAIL_ZOOM_MIN = 9;
const FETCH_CACHE_META_CHUNK_SIZE = 500;

/**
 * @deprecated Use reconcileStageTasksByMetadata instead of legacy signature filtering.
 */
const buildTaskInputSignature = (input: unknown): string => (
  buildStableSignature(input ?? null)
);

/**
 * @deprecated Use reconcileStageTasksByMetadata to align with metadata-based reconciliation.
 */
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

export const decodeGeometryCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  try {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    return await normalizeFeatureCollection(decoded);
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

export const isGeometryCacheComplete = (record: { timestamp: number } | null | undefined): record is { timestamp: number } => (
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

const featureIntersectsTileBBox = (
  feature: Feature,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  geometryEngine: GeometryEngine,
): boolean => {
  if (isAnyPointInBBox(feature.geometry ?? null, bbox)) return true;
  if (!isLineOrPolygonFeature(feature)) return false;
  const clipped = geometryBboxClip(
    feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
    [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY],
    geometryEngine,
  ) as Feature<LineString | MultiLineString | Polygon | MultiPolygon> | null;
  return Boolean(clipped?.geometry && hasCoordinates(clipped.geometry.coordinates));
};

const collectTileIdsForCollection = (
  collection: FeatureCollection,
  zBase: number,
  geometryEngine: GeometryEngine,
): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const bbox = extractGeometryStats(feature, geometryEngine).bbox;
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
        if (!featureIntersectsTileBBox(feature, tileBBox, geometryEngine)) continue;
        tileIds.add(packTileId(x, y, zBase));
      }
    }
  }
  return [...tileIds];
};

export const backfillTileRelationsFromGeometryCache = async (params: {
  nodeId: NodeId;
  bandIndex: number;
  zBase: number;
  geometryEngine: GeometryEngine;
  ephemeralStore: EphemeralDB;
}): Promise<{ relationCount: number; tileBuffers: Map<number, string[]>; bufferFeatureCounts: Map<string, number> }> => {
  const { nodeId, bandIndex, zBase, geometryEngine, ephemeralStore } = params;
  const idsRaw = await ephemeralStore.geometryCacheMeta
    .where('[nodeId+bandIndex]')
    .equals([nodeId, bandIndex])
    .primaryKeys();
  if (idsRaw.length === 0) {
    return { relationCount: 0, tileBuffers: new Map(), bufferFeatureCounts: new Map() };
  }
  const ids = idsRaw.map((id) => String(id));
  const buffers = await ephemeralStore.geometryCache.bulkGet(ids);
  const completedBuffers = buffers.filter((buffer): buffer is NonNullable<typeof buffer> => (
    Boolean(buffer && isGeometryCacheComplete(buffer))
  ));
  if (completedBuffers.length === 0) return { relationCount: 0, tileBuffers: new Map(), bufferFeatureCounts: new Map() };
  const createdAt = Date.now();
  const bufferIds = completedBuffers.map((buffer) => buffer.id);
  await ephemeralStore.tileEmitBufferRelations.where('bufferId').anyOf(bufferIds).delete();
  const pending: Array<{
    id: string;
    nodeId: NodeId;
    bandIndex: number;
    tileId: string;
    bufferId: string;
    featureCount: number;
    cacheTimestamp: number;
    createdAt: number;
  }> = [];
  const tileBuffers = new Map<number, string[]>();
  const bufferFeatureCounts = new Map<string, number>();
  let written = 0;
  const flushPending = async () => {
    if (pending.length === 0) return;
    await ephemeralStore.tileEmitBufferRelations.bulkPut(pending);
    written += pending.length;
    pending.length = 0;
  };
  for (const buffer of completedBuffers) {
    const collection = await decodeGeometryCache(buffer.data);
    if (!collection) {
      const debug = describeBuffer(buffer.data);
      console.warn('[shape-tile-emit] failed to decode geometry cache', {
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
    bufferFeatureCounts.set(buffer.id, buffer.featureCount);
    const tileIds = collectTileIdsForCollection(collection, zBase, geometryEngine);
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
        featureCount: buffer.featureCount,
        cacheTimestamp: buffer.timestamp,
        createdAt,
      });
    });
    if (pending.length >= 5000) {
      await flushPending();
    }
  }
  await flushPending();
  return { relationCount: written, tileBuffers, bufferFeatureCounts };
};

export const hasHighDetailSelection = (
  selection?: SelectedArrayByCountries,
  payloads?: SourceTaskPayload[],
): boolean => {
  if (payloads?.some((payload) => payload.adminLevel >= 2)) return true;
  if (!selection) return false;
  return Object.values(selection).some((row) => row?.some((selected, index) => selected && index >= 2));
};

export const buildGeometryByBandTasks = async (
  nodeId: NodeId,
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>,
  enableHighDetailBands: boolean,
  countryLookup: Map<string, CountryMetadata>,
  configSignature: string,
): Promise<Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>>> => {
  const tasks: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>> = [];
  let index = 0;
  let offset = 0;
  while (true) {
    const sourceBufferChunk = await ephemeralDB.sourceCacheMeta
      .where('nodeId')
      .equals(nodeId)
      .offset(offset)
      .limit(FETCH_CACHE_META_CHUNK_SIZE)
      .toArray();
    if (sourceBufferChunk.length === 0) {
      break;
    }
    offset += sourceBufferChunk.length;
    const fullBufferChunk = await ephemeralDB.sourceCache.bulkGet(
      sourceBufferChunk.map((buffer) => buffer.id),
    );
    const fullBufferById = new Map(
      fullBufferChunk
        .filter((buffer): buffer is NonNullable<typeof buffer> => buffer != null)
        .map((buffer) => [buffer.id, buffer] as const),
    );

    for (const buffer of sourceBufferChunk) {
      if (buffer.featureCount === 0) continue;
      const fullBuffer = fullBufferById.get(buffer.id);
      if (!fullBuffer) continue;
      const sourceArtifactHash = await resolveSourceArtifactHashFromRecord(
        ephemeralDB.sourceCache,
        fullBuffer,
      );
      const adminLevel = buffer.adminLevel;
      const stagePriority = typeof adminLevel === 'number' ? adminLevel : 0;
      const countryCode = buffer.countryCode?.trim().toUpperCase();
      const countryMeta = countryCode ? countryLookup.get(countryCode) : undefined;
      const bufferMetadata = (buffer.metadata ?? {}) as Record<string, unknown>;
      const sourceBaseTolerance = requireShapeSourceBaseTolerance(
        readNumericProperty(bufferMetadata, 'baseTolerance'),
      );
      for (const band of bands) {
        if (band.zMin >= HIGH_DETAIL_ZOOM_MIN) {
          if (!enableHighDetailBands) continue;
          if (typeof adminLevel !== 'number' || adminLevel < 2) continue;
        }
        const cacheIdentity = buildGeometryTaskCacheIdentity({
          nodeId,
          sourceKey: buffer.sourceKey,
          bandIndex: band.bandIndex,
          sourceArtifactHash: sourceArtifactHash,
          sourceBaseTolerance,
          bandMinZoom: band.zMin,
          bandMaxZoom: band.zMax,
          configSignature,
        });
        tasks.push({
          taskId: `${String(nodeId)}:geometry:${band.bandIndex}:${buffer.sourceKey}`,
          nodeId,
          version: 1,
          stage: 'geometry',
          status: 'queued',
          index,
          stagePriority,
          progress: 0,
          inputData: {
            sourceCacheId: buffer.id,
            sourceArtifactHash: sourceArtifactHash,
            bandIndex: band.bandIndex,
            bandMinZoom: band.zMin,
            bandMaxZoom: band.zMax,
            sourceBaseTolerance,
            inputVertexCount: buffer.vertexCount ?? buffer.inputVertexCount,
            inputPolygonCount: buffer.polygonCount ?? buffer.inputPolygonCount,
            domainType: 'shape',
            sourceKey: buffer.sourceKey,
            stagePriority,
            countryCode,
            countryName: countryMeta?.countryName,
            adminLevel: buffer.adminLevel,
            configSignature,
            cacheKey: cacheIdentity.cacheKey,
            inputHash: cacheIdentity.inputHash,
          },
        });
        index += 1;
      }
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

export const buildTileEmitTasks = async (
  nodeId: NodeId,
  ephemeralStore: EphemeralDB,
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>,
  enableHighDetailBands: boolean,
  configSignature: string,
  geometryEngine: GeometryEngine,
): Promise<Array<TaskQueueRecord<ShapeTileEmitTaskInput>>> => {
  const tasks: Array<TaskQueueRecord<ShapeTileEmitTaskInput>> = [];
  let index = 0;

  for (const band of bands) {
    const isHighDetailBand = band.zMin >= HIGH_DETAIL_ZOOM_MIN;
    if (isHighDetailBand && !enableHighDetailBands) continue;
    const tileBuffers = new Map<number, string[]>();
    const bufferFeatureCounts = new Map<string, number>();
    let relationCount = 0;
    const buildTileBuffers = async () => {
      await ephemeralStore.tileEmitBufferRelations
        .where('[nodeId+bandIndex]')
        .equals([nodeId, band.bandIndex])
        .each((row) => {
          relationCount += 1;
          const tileId = Number(row.tileId);
          if (!Number.isFinite(tileId)) return;
          const featureCount = typeof row.featureCount === 'number' && Number.isFinite(row.featureCount)
            ? row.featureCount
            : undefined;
          if (featureCount !== undefined && !bufferFeatureCounts.has(row.bufferId)) {
            bufferFeatureCounts.set(row.bufferId, featureCount);
          }
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
      const backfilled = await backfillTileRelationsFromGeometryCache({
        nodeId,
        bandIndex: band.bandIndex,
        zBase: band.zBase,
        geometryEngine,
        ephemeralStore,
      });
      relationCount = backfilled.relationCount;
      if (relationCount > 0) {
        tileBuffers.clear();
        backfilled.tileBuffers.forEach((value, key) => {
          tileBuffers.set(key, value);
        });
        backfilled.bufferFeatureCounts.forEach((value, key) => {
          bufferFeatureCounts.set(key, value);
        });
        console.warn('[shape-tile-emit] rebuilt missing tile relations', {
          nodeId,
          bandIndex: band.bandIndex,
          relationCount,
        });
      }
    }
    console.info('[shape-tile-emit] tile relation snapshot', {
      nodeId,
      bandIndex: band.bandIndex,
      zBase: band.zBase,
      relationCount,
      tileCount: tileBuffers.size,
      tileSample: [...tileBuffers.keys()].slice(0, 5),
    });
    const tileIds = [...tileBuffers.keys()];
    for (const tileId of tileIds) {
      const bufferIds = tileBuffers.get(tileId) ?? [];
      if (bufferIds.length === 0) continue;
      const usableBufferIds = [...new Set(bufferIds)];
      if (usableBufferIds.length === 0) continue;
      const featureCount = usableBufferIds.reduce((sum, bufferId) => sum + (bufferFeatureCounts.get(bufferId) ?? 0), 0);
      const cacheIdentity = buildTileEmitTaskCacheIdentity({
        nodeId,
        bandIndex: band.bandIndex,
        zBase: band.zBase,
        tileId,
        bufferIds: usableBufferIds,
        bandMinZoom: band.zMin,
        bandMaxZoom: band.zMax,
        configSignature,
      });
      tasks.push({
        taskId: `${String(nodeId)}:tileEmit:${band.bandIndex}:${band.zBase}:${tileId}`,
        nodeId,
        version: 1,
        stage: 'tileEmit',
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
          cacheKey: cacheIdentity.cacheKey,
          inputHash: cacheIdentity.inputHash,
        },
      });
      index += 1;
    }
  }

  return tasks;
};

export const resolveGeometryConfig = (config: ShapeRuntimeBuildConfig) => config.geometryConfig;

export const resolveTileEmitConfig = (config: ShapeRuntimeBuildConfig) => config.tileEmitConfig;

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
