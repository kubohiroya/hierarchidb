import type { NodeId } from '@hierarchidb/common-types';
import {
  VtTaskQueueDb,
  deleteTasksByNode,
  putTasks,
  runStageTasks,
  createTransformHandler,
  createVtHandler,
} from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord, StageHandler } from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, listStage1Buffers, listBufferIdsByTile } from '@hierarchidb/vt-shape-store';
import { VtDb } from '@hierarchidb/vt-store';
import type { BatchConfig, CountryMetadata, DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../common/types/constants.js';
import { runShapeFetchStage } from './shapeFetchStage.js';
import { updateShapeStageMetadata } from './shapeStageMetadata.js';
import { metadataLoader } from '../metadata/MetadataLoader.js';

type ShapeTransformTaskInput = {
  stage1BufferId: string;
  bandId: number;
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

const DEFAULT_TASK_SPLIT = {
  maxBuffersPerTask: 128,
  maxVerticesPerTask: 100_000,
  maxBand3Reservations: 50_000,
} as const;

const buildBands = (enableBand3: boolean) => {
  const bands = [
    { bandId: 0, zMin: 0, zMax: 3, zBase: 0 },
    { bandId: 1, zMin: 3, zMax: 6, zBase: 3 },
    { bandId: 2, zMin: 6, zMax: 9, zBase: 6 },
  ];
  if (enableBand3) {
    bands.push({ bandId: 3, zMin: 9, zMax: 11, zBase: 9 });
  }
  return bands;
};

const hasBand3Selection = (
  selection?: SelectedArrayByCountries,
  payloads?: FetchTaskPayload[],
): boolean => {
  if (payloads && payloads.some((payload) => payload.adminLevel >= 2)) return true;
  if (!selection) return false;
  return Object.values(selection).some((row) => row?.some((selected, index) => selected && index >= 2));
};

const buildTransformTasks = async (
  nodeId: NodeId,
  shapeStore: VtShapeDb,
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>,
  enableBand3: boolean,
  countryLookup: Map<string, CountryMetadata>,
): Promise<Array<TaskQueueRecord<ShapeTransformTaskInput>>> => {
  const buffers = await listStage1Buffers(shapeStore, nodeId);
  const tasks: Array<TaskQueueRecord<ShapeTransformTaskInput>> = [];
  let index = 0;

  for (const buffer of buffers) {
    const adminLevel = buffer.adminLevel;
    const stagePriority = typeof adminLevel === 'number' ? adminLevel : 0;
    const countryCode = buffer.countryCode?.trim().toUpperCase();
    const countryMeta = countryCode ? countryLookup.get(countryCode) : undefined;
    for (const band of bands) {
      if (band.bandId === 3) {
        if (!enableBand3) continue;
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
          stage1BufferId: buffer.id,
          bandId: band.bandId,
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

const listFixedTiles = (zBase: number): number[] => {
  const tiles: number[] = [];
  const size = 1 << zBase;
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      tiles.push(((x << zBase) | y) as number);
    }
  }
  return tiles;
};

const buildVtTasks = async (
  nodeId: NodeId,
  shapeStore: VtShapeDb,
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>,
  enableBand3: boolean,
  maxBuffersPerTask: number,
  maxVerticesPerTask: number,
): Promise<Array<TaskQueueRecord<ShapeVtTaskInput>>> => {
  const tasks: Array<TaskQueueRecord<ShapeVtTaskInput>> = [];
  let index = 0;

  for (const band of bands) {
    if (band.bandId === 3 && !enableBand3) continue;
    const tileIds = band.bandId === 3
      ? (await shapeStore.vtBand3Reservations.where('nodeId').equals(nodeId).toArray())
        .map((entry) => entry.tileId)
      : listFixedTiles(band.zBase);
    for (const tileId of tileIds) {
      const bufferIds = await listBufferIdsByTile(shapeStore, nodeId, band.bandId, tileId);
      if (bufferIds.length === 0) continue;
      const buffers = await shapeStore.transformBandBuffers.where('id').anyOf(bufferIds).toArray();
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

const resolveTransformConfig = (config: BatchConfig) => {
  const tileConfig = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;
  const extract1Config = config.extract1Config ?? DEFAULT_PROCESSING_CONFIG.extract1Config;
  return {
    toleranceK: extract1Config?.tolerance ?? 1,
    tileIndex: {
      buffer: tileConfig?.bufferSize ?? 256,
      extent: 4096,
      promoteId: 'id',
    },
  };
};

const resolveVtConfig = (config: BatchConfig) => {
  const tileConfig = config.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;
  const extract2Config = config.extract2Config ?? DEFAULT_PROCESSING_CONFIG.extract2Config;
  return {
    extent: 4096,
    buffer: tileConfig?.bufferSize ?? 256,
    tileSize: 256,
    vtSimplificationTolerance: extract2Config?.tolerance ?? 1,
    boundaryDedupe: true,
    layers: [],
    layerSetName: 'shape',
  };
};

export type ShapeVtPipelineParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  batchConfig: BatchConfig;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  waitIfPaused?: () => Promise<void>;
};

export const runShapeVtPipeline = async (params: ShapeVtPipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const shapeStore = new VtShapeDb();
  const vtStore = new VtDb();
  await deleteTasksByNode(taskQueue, params.nodeId);

  const metadata = await metadataLoader.loadMetadata(params.dataSource, params.nodeId);
  const countryLookup = buildCountryLookup(metadata);
  const enableBand3 = hasBand3Selection(params.selectedArrayByCountries, params.downloadTaskPayloads);
  const bands = buildBands(enableBand3);

  await runShapeFetchStage({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    selectedArrayByCountries: params.selectedArrayByCountries,
    downloadTaskPayloads: params.downloadTaskPayloads,
    batchConfig: params.batchConfig,
    taskQueue,
    shapeStore,
    metadata,
    waitIfPaused: params.waitIfPaused,
  });

  const transformTasks = await buildTransformTasks(params.nodeId, shapeStore, bands, enableBand3, countryLookup);
  if (transformTasks.length > 0) {
    await params.waitIfPaused?.();
    await putTasks(taskQueue, transformTasks as Array<TaskQueueRecord<ShapeTransformTaskInput>>);
    const transformHandler = createTransformHandler({
      shapeStore,
      transformConfig: resolveTransformConfig(params.batchConfig),
      bands,
      maxBand3Reservations: DEFAULT_TASK_SPLIT.maxBand3Reservations,
    });
    await runStageTasks({
      db: taskQueue,
      nodeId: params.nodeId,
      stage: 'transform',
      handler: transformHandler as unknown as StageHandler<ShapeTransformTaskInput>,
      waitIfPaused: params.waitIfPaused,
    });
  }

  const vtTasks = await buildVtTasks(
    params.nodeId,
    shapeStore,
    bands,
    enableBand3,
    DEFAULT_TASK_SPLIT.maxBuffersPerTask,
    DEFAULT_TASK_SPLIT.maxVerticesPerTask,
  );
  if (vtTasks.length > 0) {
    await params.waitIfPaused?.();
    await putTasks(taskQueue, vtTasks as Array<TaskQueueRecord<ShapeVtTaskInput>>);
    const vtHandler = createVtHandler({
      shapeStore,
      vtStore,
      vtConfig: resolveVtConfig(params.batchConfig),
      bands,
    });
    await runStageTasks({
      db: taskQueue,
      nodeId: params.nodeId,
      stage: 'vt',
      handler: vtHandler as unknown as StageHandler<ShapeVtTaskInput>,
      waitIfPaused: params.waitIfPaused,
    });
  }

  await updateShapeStageMetadata({
    nodeId: params.nodeId,
    dataSource: params.dataSource,
    shapeStore,
    vtStore,
  });
};
