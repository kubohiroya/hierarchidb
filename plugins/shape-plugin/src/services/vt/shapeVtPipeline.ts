import type { BuildContinuationPolicy, NodeId, StageHandler, TaskQueueRecord } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { bbox as turfBbox } from '@turf/turf';
import { geojson as geojsonApi } from 'flatgeobuf';
import { latToTileY, lonToTileX } from '@hierarchidb/gis-sdk';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  listTasksByStage,
  listTasksByStageAndStatus,
  putTasks,
  runStageTasks,
  createTransformByBandHandler,
  createVtHandler,
} from '@hierarchidb/vt-orchestrator';
import { DEFAULT_TASK_SPLIT } from '@hierarchidb/vt-orchestrator';
import {
  VtShapeDb,
  listFetchCache,
  SHAPE_DOMAIN,
} from '@hierarchidb/vt-shape-store';
import { ephemeralShapeDB } from '@hierarchidb/shape-store';
import { VtDb } from '@hierarchidb/vt-store';
import type { CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { runShapeFetchStage } from './shapeFetchStage.js';
import { updateShapeStageMetadata } from './shapeStageMetadata.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
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
};

type ShapeVtTaskInput = {
  bandId: number;
  zBase: number;
  tileId: number;
  bufferIds: string[];
  domainType: 'shape';
  sourceKey: string;
};

const HIGH_DETAIL_ZOOM_MIN = 9;

const buildBands = (zoomBandBoundaries: number[]) => {
  const ranges = buildZoomBandRanges(zoomBandBoundaries, ZOOM_BAND_MIN_ZOOM, ZOOM_BAND_MAX_ZOOM);
  return ranges.map((range, index) => ({
    bandId: index,
    zMin: range.min,
    zMax: range.max,
    zBase: range.min,
  }));
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

const packTileId = (x: number, y: number, z: number): number => (x << z) | y;

const clampTileIndex = (value: number, maxIndex: number): number => (
  Math.min(maxIndex, Math.max(0, value))
);

const collectTileIdsForCollection = (collection: FeatureCollection, zBase: number): number[] => {
  if (!Number.isFinite(zBase) || zBase < 0) return [];
  const maxIndex = (1 << zBase) - 1;
  const tileIds = new Set<number>();
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    const [minLon, minLat, maxLon, maxLat] = turfBbox(feature as Feature<Geometry>);
    if (![minLon, minLat, maxLon, maxLat].every((value) => Number.isFinite(value))) continue;
    const x1 = clampTileIndex(lonToTileX(minLon, zBase), maxIndex);
    const x2 = clampTileIndex(lonToTileX(maxLon, zBase), maxIndex);
    const y1 = clampTileIndex(latToTileY(maxLat, zBase), maxIndex);
    const y2 = clampTileIndex(latToTileY(minLat, zBase), maxIndex);
    for (let x = x1; x <= x2; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
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
}): Promise<number> => {
  const { nodeId, bandId, zBase, ephemeralStore } = params;
  const buffers = await ephemeralStore.transaction('r', ephemeralStore.transformCache, async () => (
    ephemeralStore.transformCache
      .where('[nodeId+bandId]')
      .equals([nodeId, bandId])
      .toArray()
  ));
  const completedBuffers = buffers.filter((buffer) => isTransformCacheComplete(buffer));
  if (completedBuffers.length === 0) return 0;
  const relations: Array<{
    id: string;
    nodeId: NodeId;
    bandId: number;
    tileId: string;
    bufferId: string;
    createdAt: number;
  }> = [];
  const createdAt = Date.now();
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
      relations.push({
        id: `${String(nodeId)}:${bandId}:${tileId}:${buffer.id}`,
        nodeId,
        bandId,
        tileId: String(tileId),
        bufferId: buffer.id,
        createdAt,
      });
    });
  }
  if (relations.length === 0) return 0;
  const bufferIds = Array.from(new Set(relations.map((row) => row.bufferId)));
  await ephemeralStore.tileIdToBufferRelations.where('bufferId').anyOf(bufferIds).delete();
  await ephemeralStore.tileIdToBufferRelations.bulkPut(relations);
  return relations.length;
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
  shapeStore: VtShapeDb,
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>,
  enableHighDetailBands: boolean,
  countryLookup: Map<string, CountryMetadata>,
): Promise<Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>> => {
  const buffers = await listFetchCache(shapeStore, nodeId);
  const tasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
  let index = 0;

  for (const buffer of buffers) {
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

const splitBufferIds = (
  bufferIds: string[],
  vertexById: Map<string, number>,
  maxBuffers: number,
  maxVertices: number,
): string[][] => {
  const sorted = [...bufferIds].sort();
  const chunks: string[][] = [];
  let current: string[] = [];
  let vertexCount = 0;

  for (const bufferId of sorted) {
    const nextVertices = vertexById.get(bufferId) ?? 0;
    const wouldOverflow = current.length >= maxBuffers || (vertexCount + nextVertices) > maxVertices;
    if (current.length > 0 && wouldOverflow) {
      chunks.push(current);
      current = [];
      vertexCount = 0;
    }
    current.push(bufferId);
    vertexCount += nextVertices;
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
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
  maxBuffersPerTask: number,
  maxVerticesPerTask: number,
): Promise<Array<TaskQueueRecord<ShapeVtTaskInput>>> => {
  const tasks: Array<TaskQueueRecord<ShapeVtTaskInput>> = [];
  let index = 0;

  for (const band of bands) {
    const isHighDetailBand = band.zMin >= HIGH_DETAIL_ZOOM_MIN;
    if (isHighDetailBand && !enableHighDetailBands) continue;
    let relationRows = await ephemeralStore.tileIdToBufferRelations
      .where('[nodeId+bandId]')
      .equals([nodeId, band.bandId])
      .toArray();
    if (relationRows.length === 0) {
      const backfilled = await backfillTileRelationsFromTransformCache({
        nodeId,
        bandId: band.bandId,
        zBase: band.zBase,
        ephemeralStore,
      });
      if (backfilled > 0) {
        relationRows = await ephemeralStore.tileIdToBufferRelations
          .where('[nodeId+bandId]')
          .equals([nodeId, band.bandId])
          .toArray();
        console.warn('[shape-vt] rebuilt missing tile relations', {
          nodeId,
          bandId: band.bandId,
          relationCount: relationRows.length,
        });
      }
    }
    const tileBuffers = new Map<number, string[]>();
    relationRows.forEach((row) => {
      const tileId = Number(row.tileId);
      if (!Number.isFinite(tileId)) return;
      const bucket = tileBuffers.get(tileId);
      if (bucket) {
        bucket.push(row.bufferId);
      } else {
        tileBuffers.set(tileId, [row.bufferId]);
      }
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
      const vertexById = new Map(completedBuffers.map((buffer) => [buffer.id, buffer.vertexCount] as const));
      const chunks = splitBufferIds(usableBufferIds, vertexById, maxBuffersPerTask, maxVerticesPerTask);
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];
        if (!chunk) continue;
        tasks.push({
          taskId: `${String(nodeId)}:vt:${band.bandId}:${band.zBase}:${tileId}:${chunkIndex}`,
          nodeId,
          stage: 'vt',
          status: 'queued',
          index,
          progress: 0,
          inputData: {
            bandId: band.bandId,
            zBase: band.zBase,
            tileId,
            bufferIds: chunk,
            domainType: 'shape',
            sourceKey: 'mixed',
          },
        });
        index += 1;
      }
    }
  }

  return tasks;
};

const resolveTransformConfig = (config: ShapeBuildConfig) => config.transformConfig;

const resolveVtConfig = (config: ShapeBuildConfig) => config.vtConfig;

export type ShapeVtPipelineParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  buildConfig: ShapeBuildConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
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

export const runShapeVtPipeline = async (params: ShapeVtPipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const shapeStore = new VtShapeDb();
  const ephemeralStore = ephemeralShapeDB;
  const vtStore = new VtDb();
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
  const buildContinuationPolicy = params.buildContinuationPolicy ?? 'finish_all_stages';
  const failureHandling = resolveFailureHandling(buildContinuationPolicy);
  let stopAfterStage = false;
  if (!resumeExistingTasks) {
    await deleteTasksByNode(taskQueue, params.nodeId);
  }

  const metadata = await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  const countryLookup = buildCountryLookup(metadata);
  const enableHighDetailBands = hasHighDetailSelection(
    params.selectedArrayByCountries,
    params.downloadTaskPayloads,
  );
  const bands = buildBands(params.buildConfig.transformConfig.zoomBandBoundaries);

  const fetchAbortController = new AbortController();
  await runShapeFetchStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    selectedArrayByCountries: params.selectedArrayByCountries,
    downloadTaskPayloads: params.downloadTaskPayloads,
    buildConfig: params.buildConfig,
    taskQueue,
    shapeStore,
    metadata,
    waitIfPaused: params.waitIfPaused,
    resumeExistingTasks,
    abortController: fetchAbortController,
    failureHandling,
  });
  if (shouldStopAfterStage(buildContinuationPolicy, await getFailedTaskCount(taskQueue, params.nodeId, 'fetch'))) {
    stopAfterStage = true;
  }

  if (!stopAfterStage) {
    const existingTransformByBandTasks = resumeExistingTasks
      ? await listTasksByStage(taskQueue, params.nodeId, 'transform')
      : [];
    const transformByBandTasks = existingTransformByBandTasks.length > 0
      ? []
      : await buildTransformByBandTasks(params.nodeId, shapeStore, bands, enableHighDetailBands, countryLookup);
    if (existingTransformByBandTasks.length > 0 || transformByBandTasks.length > 0) {
      await params.waitIfPaused?.();
      if (transformByBandTasks.length > 0) {
        await putTasks(taskQueue, transformByBandTasks as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>);
      }
      const transformByBandAbortController = new AbortController();
      const transformByBandHandler = createTransformByBandHandler({
        shapeDB: shapeStore,
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
      if (shouldStopAfterStage(buildContinuationPolicy, await getFailedTaskCount(taskQueue, params.nodeId, 'transform'))) {
        stopAfterStage = true;
      }
      if (params.buildConfig.fetchConfig.deleteOnComplete) {
        await shapeStore.fetchCache.where('nodeId').equals(params.nodeId).delete();
      }
    }
  }

  if (!stopAfterStage) {
    const existingVtTasks = resumeExistingTasks
      ? await listTasksByStage(taskQueue, params.nodeId, 'vt')
      : [];
    const vtTasks = existingVtTasks.length > 0
      ? []
      : await buildVtTasks(
        params.nodeId,
        ephemeralStore,
        bands,
        enableHighDetailBands,
        DEFAULT_TASK_SPLIT.maxBuffersPerTask,
        DEFAULT_TASK_SPLIT.maxVerticesPerTask,
      );
    if (existingVtTasks.length > 0 || vtTasks.length > 0) {
      await params.waitIfPaused?.();
      if (vtTasks.length > 0) {
        await putTasks(taskQueue, vtTasks as Array<TaskQueueRecord<ShapeVtTaskInput>>);
      }
      const vtAbortController = new AbortController();
      const vtHandler = createVtHandler({
        ephemeralDB: ephemeralStore,
        vtDB: vtStore,
        vtConfig: resolveVtConfig(params.buildConfig),
        bands,
        abortSignal: vtAbortController.signal,
      });
      await runStageTasks({
        nodeId: params.nodeId,
        stage: 'vt',
        handler: vtHandler as unknown as StageHandler<ShapeVtTaskInput>,
        waitIfPaused: params.waitIfPaused,
        maxConcurrent: params.buildConfig.vtConfig.maxConcurrent,
        failureHandling,
        abortController: vtAbortController,
      });
      if (params.buildConfig.transformConfig.deleteOnComplete) {
        await ephemeralStore.transaction('rw', ephemeralStore.transformCache, async () => {
          await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
        });
      }
    }
  }

  await updateShapeStageMetadata({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    shapeStore,
    vtStore,
  });

  const cleanupConfig = params.buildConfig.cleanupConfig;
  if (cleanupConfig?.deleteFetchCeche) {
    await shapeStore.fetchCache
      .where('[nodeId+domainType]')
      .equals([params.nodeId, SHAPE_DOMAIN])
      .delete();
  }
  if (cleanupConfig?.deleteTransformCache) {
    await ephemeralStore.transaction('rw', ephemeralStore.transformCache, async () => {
      await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
    });
  }
  if (cleanupConfig?.deleteVTCache) {
    await vtStore.vtTiles.where('nodeId').equals(params.nodeId).delete();
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
