import type { NodeId } from '@hierarchidb/common-types';
import { VtTaskQueueDb, deleteTasksByNode, putTasks, runTransform, runVt } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord } from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, listStage1Buffers, listBufferIdsByTile } from '@hierarchidb/vt-shape-store';
import { VtDb } from '@hierarchidb/vt-store';
import type { BatchConfig, DataSourceName, DownloadTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG } from '../../common/types/constants.js';
import { runShapeFetchStage } from './shapeFetchStage.js';

type ShapeTransformTaskInput = {
  stage1BufferId: string;
  bandId: number;
  domainType: 'shape';
  sourceKey: string;
  stagePriority?: number;
  countryCode?: string;
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
    { bandId: 0, zMin: 0, zMax: 2, zBase: 0 },
    { bandId: 1, zMin: 3, zMax: 5, zBase: 3 },
    { bandId: 2, zMin: 6, zMax: 8, zBase: 6 },
  ];
  if (enableBand3) {
    bands.push({ bandId: 3, zMin: 9, zMax: 11, zBase: 9 });
  }
  return bands;
};

const hasBand3Selection = (
  selection?: SelectedArrayByCountries,
  payloads?: DownloadTaskPayload[],
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
): Promise<Array<TaskQueueRecord<ShapeTransformTaskInput>>> => {
  const buffers = await listStage1Buffers(shapeStore, nodeId);
  const tasks: Array<TaskQueueRecord<ShapeTransformTaskInput>> = [];
  let index = 0;

  for (const buffer of buffers) {
    const adminLevel = buffer.adminLevel;
    const stagePriority = typeof adminLevel === 'number' ? adminLevel : 0;
    for (const band of bands) {
      if (band.bandId === 3) {
        if (!enableBand3) continue;
        if (typeof adminLevel !== 'number' || adminLevel < 2) continue;
      }
      tasks.push({
        taskId: `${String(nodeId)}:transform:${band.bandId}:${buffer.sourceKey}`,
        nodeId,
        stage: 'transform',
        status: 'waiting',
        index,
        stagePriority,
        progress: 0,
        inputData: {
          stage1BufferId: buffer.id,
          bandId: band.bandId,
          domainType: 'shape',
          sourceKey: buffer.sourceKey,
          stagePriority,
          countryCode: buffer.countryCode,
          adminLevel: buffer.adminLevel,
        },
      });
      index += 1;
    }
  }
  return tasks;
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
          status: 'waiting',
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
  downloadTaskPayloads?: DownloadTaskPayload[];
};

export const runShapeVtPipeline = async (params: ShapeVtPipelineParams): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const shapeStore = new VtShapeDb();
  const vtStore = new VtDb();
  await deleteTasksByNode(taskQueue, params.nodeId);

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
  });

  const transformTasks = await buildTransformTasks(params.nodeId, shapeStore, bands, enableBand3);
  if (transformTasks.length > 0) {
    await putTasks(taskQueue, transformTasks as Array<TaskQueueRecord<ShapeTransformTaskInput>>);
    await runTransform({
      nodeId: params.nodeId,
      taskQueue,
      transformContext: {
        shapeStore,
        transformConfig: resolveTransformConfig(params.batchConfig),
        bands,
        maxBand3Reservations: DEFAULT_TASK_SPLIT.maxBand3Reservations,
      },
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
    await putTasks(taskQueue, vtTasks as Array<TaskQueueRecord<ShapeVtTaskInput>>);
    await runVt({
      nodeId: params.nodeId,
      taskQueue,
      vtContext: {
        shapeStore,
        vtStore,
        vtConfig: resolveVtConfig(params.batchConfig),
        bands,
      },
    });
  }
};
