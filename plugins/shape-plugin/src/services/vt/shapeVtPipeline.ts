import type { NodeId, StageHandler, TaskQueueRecord } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  listTasksByStage,
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
    const relationRows = await ephemeralStore.tileIdToBufferRelations
      .where('[nodeId+bandId]')
      .equals([nodeId, band.bandId])
      .toArray();
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
      const buffers = await ephemeralStore.transformCache.where('id').anyOf(bufferIds).toArray();
      const vertexById = new Map(buffers.map((buffer) => [buffer.id, buffer.vertexCount] as const));
      const chunks = splitBufferIds(bufferIds, vertexById, maxBuffersPerTask, maxVerticesPerTask);
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
};

export const runShapeVtPipeline = async (params: ShapeVtPipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const shapeStore = new VtShapeDb();
  const ephemeralStore = ephemeralShapeDB;
  const vtStore = new VtDb();
  const resumeExistingTasks = Boolean(params.resumeExistingTasks);
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
  });

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
      failureHandling: 'stop',
      abortController: transformByBandAbortController,
    });
    if (params.buildConfig.fetchConfig.deleteOnComplete) {
      await shapeStore.fetchCache.where('nodeId').equals(params.nodeId).delete();
    }
  }

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
      failureHandling: 'stop',
      abortController: vtAbortController,
    });
    if (params.buildConfig.transformConfig.deleteOnComplete) {
      await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
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
    await ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
  }
  if (cleanupConfig?.deleteVTCache) {
    await vtStore.vtTiles.where('nodeId').equals(params.nodeId).delete();
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
