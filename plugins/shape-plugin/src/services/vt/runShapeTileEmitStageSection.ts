import type { StageHandler, TaskQueueRecord, TaskStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { buildStableJsonSignature, type EphemeralDB } from '@hierarchidb/gis-sdk';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import {
  createVtHandler as createTileEmitHandler,
  listTasksByStage,
  listTasksByStageAndStatus,
  putTasks,
  runStageTasks,
  updateTask,
  type VtTaskQueueDb as TileEmitTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { ShapeTileEmitTaskInput } from './shapePipelineShared.ts';
import { buildShapeVectorTileRecord, buildTileEmitTasks, resolveTileEmitConfig } from './shapePipelineShared.ts';
import type { Tile } from 'geojson-vt';
import { applyStageTaskReconcile } from './shapeStageReconcile.ts';
import { resolveTaskCacheIdentity } from './shapeTaskCacheIdentity.ts';
import {
  createPipelineLinkedAbortController,
  finalizePendingStageTasks,
  markStageTasksRecycled,
  readHeapSnapshot,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';
import { resolveToleranceByBand } from '~/services/utils/toleranceByBand';

export type ShapeTileEmitStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>;
  enableHighDetailBands: boolean;
  taskQueue: TileEmitTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  pipelineRunId?: string;
  abortSignal?: AbortSignal;
  ephemeralStore: EphemeralDB;
  loadContinentLookup: () => Promise<Map<string, string>>;
  onStageTasksPrepared?: (payload: {
    nodeId: NodeId;
    stage: TaskStage;
    taskCount: number;
  }) => Promise<void> | void;
};

const loadFeatureGeojsonByteSizeById = async (nodeId: NodeId): Promise<Map<string, number>> => {
  const rows = await shapeQueryAPIImpl.listFeatureMetadata(nodeId);
  const map = new Map<string, number>();
  let invalidByteSizeCount = 0;
  let positiveByteSizeCount = 0;
  let zeroByteSizeCount = 0;
  const upsert = (key: string, byteSize: number): void => {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) return;
    const previous = map.get(normalizedKey);
    if (previous === undefined || byteSize > previous) {
      map.set(normalizedKey, byteSize);
    }
  };
  rows.forEach((row) => {
    if (!row?.featureId) return;
    if (typeof row.geojsonByteSize !== 'number' || !Number.isFinite(row.geojsonByteSize)) {
      invalidByteSizeCount += 1;
      return;
    }
    const normalizedByteSize = Math.max(0, Math.round(row.geojsonByteSize));
    if (normalizedByteSize > 0) {
      positiveByteSizeCount += 1;
    } else {
      zeroByteSizeCount += 1;
    }
    upsert(row.featureId, normalizedByteSize);
    const firstColonIndex = row.featureId.indexOf(':');
    const lastColonIndex = row.featureId.lastIndexOf(':');
    if (firstColonIndex > 0 && lastColonIndex > firstColonIndex) {
      const aliasKey = row.featureId.slice(firstColonIndex + 1, lastColonIndex);
      upsert(aliasKey, normalizedByteSize);
    }
  });
  if (rows.length > 0 && map.size === 0) {
    console.warn('[ShapeTileEmitParentInputSummary] feature metadata has no valid geojsonByteSize', {
      nodeId: String(nodeId),
      rowCount: rows.length,
      invalidByteSizeCount,
    });
  } else if (rows.length > 0) {
    console.info('[ShapeTileEmitParentInputSummary] feature metadata byte-size map loaded', {
      nodeId: String(nodeId),
      rowCount: rows.length,
      mapSize: map.size,
      positiveByteSizeCount,
      zeroByteSizeCount,
      invalidByteSizeCount,
    });
  }
  return map;
};

export const runShapeTileEmitStageSection = async (params: ShapeTileEmitStageParams): Promise<void> => {
  const tileEmitAbortController = createPipelineLinkedAbortController(params.abortSignal);
  const assertTileEmitPipelineActive = (): void => {
    if (tileEmitAbortController.signal.aborted) {
      throw new DOMException('Tile emit pipeline was aborted', 'AbortError');
    }
  };
  assertTileEmitPipelineActive();
  const tileEmitConfig = resolveTileEmitConfig(params.buildConfig);
  const geometryEngine = params.buildConfig.geometryConfig.geometryEngine ?? 'turf';
  let existingTileEmitTasks = params.resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'tileEmit')
    : [];
  assertTileEmitPipelineActive();
  existingTileEmitTasks.forEach((task) => {
    resolveTaskCacheIdentity(task);
  });
  const tileEmitConfigSignature = buildStableJsonSignature(tileEmitConfig);
  const desiredTileEmitTasks = await buildTileEmitTasks(
    params.nodeId,
    params.ephemeralStore,
    params.bands,
    params.enableHighDetailBands,
    tileEmitConfigSignature,
    geometryEngine,
  );
  assertTileEmitPipelineActive();
  let missingTileEmitTasks: Array<TaskQueueRecord<ShapeTileEmitTaskInput>> = [];
  if (params.resumeExistingTasks && existingTileEmitTasks.length > 0) {
    const reconciled = await applyStageTaskReconcile({
      taskQueue: params.taskQueue,
      nodeId: params.nodeId,
      stage: 'tileEmit',
      desiredTasks: desiredTileEmitTasks,
      existingTasks: existingTileEmitTasks,
      resumeExistingTasks: true,
    });
    assertTileEmitPipelineActive();
    existingTileEmitTasks = reconciled.existingTasks as Array<TaskQueueRecord<ShapeTileEmitTaskInput>>;
    missingTileEmitTasks = reconciled.missingTasks as Array<TaskQueueRecord<ShapeTileEmitTaskInput>>;
  }
  if (params.resumeExistingTasks && existingTileEmitTasks.length > 0) {
    const runningTileEmitTasks = await listTasksByStageAndStatus(params.taskQueue, params.nodeId, 'tileEmit', 'running');
    assertTileEmitPipelineActive();
    if (runningTileEmitTasks.length > 0) {
      await Promise.all(runningTileEmitTasks.map((task) => (
        updateTask(params.taskQueue, task.taskId, {
          status: 'failed',
          errorMessage: 'aborted: resume cleared running tileEmit task',
          completedAt: Date.now(),
        })
      )));
      assertTileEmitPipelineActive();
    }
  }
  if (params.resumeExistingTasks) {
    assertTileEmitPipelineActive();
    await markStageTasksRecycled(params.taskQueue, params.nodeId, 'tileEmit');
    assertTileEmitPipelineActive();
  }
  if (params.resumeExistingTasks && existingTileEmitTasks.length === 0) {
    missingTileEmitTasks = desiredTileEmitTasks as Array<TaskQueueRecord<ShapeTileEmitTaskInput>>;
    if (missingTileEmitTasks.length > 0) {
      assertTileEmitPipelineActive();
      await putTasks(params.taskQueue, missingTileEmitTasks);
      assertTileEmitPipelineActive();
    }
  } else if (!params.resumeExistingTasks) {
    missingTileEmitTasks = desiredTileEmitTasks as Array<TaskQueueRecord<ShapeTileEmitTaskInput>>;
    if (missingTileEmitTasks.length > 0) {
      assertTileEmitPipelineActive();
      await putTasks(params.taskQueue, missingTileEmitTasks);
      assertTileEmitPipelineActive();
    }
  }
  console.warn('[ShapeTileEmit][PipelineMetrics] tileEmit task prep', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    existingTaskCount: existingTileEmitTasks.length,
    newTaskCount: missingTileEmitTasks.length,
  }));
  if (existingTileEmitTasks.length === 0 && missingTileEmitTasks.length === 0) {
    return;
  }
  if (params.onStageTasksPrepared) {
    assertTileEmitPipelineActive();
    await params.onStageTasksPrepared({
      nodeId: params.nodeId,
      stage: 'tileEmit',
      taskCount: existingTileEmitTasks.length + missingTileEmitTasks.length,
    });
    assertTileEmitPipelineActive();
  }
  assertTileEmitPipelineActive();
  await params.waitIfPaused?.();
  assertTileEmitPipelineActive();
  console.warn('[ShapeTileEmit][PipelineMetrics] tileEmit queue snapshot', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'tileEmit'),
  }));
  console.warn('[ShapeTileEmit][PipelineMetrics] stage tileEmit start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    bands: params.bands.length,
    heap: readHeapSnapshot(),
  }));
  const continentByCountry = params.bands.some((band) => band.zMin === 0)
    ? await params.loadContinentLookup()
    : undefined;
  assertTileEmitPipelineActive();
  const featureGeojsonByteSizeById = await loadFeatureGeojsonByteSizeById(params.nodeId);
  assertTileEmitPipelineActive();
  const transformRetryToleranceStep = params.buildConfig.geometryConfig.retryToleranceStep;
  const isTopojsonSource = params.buildConfig.dataSourceName === 'geoboundaries-topojson';
  const resolvedTopojsonBandIndex = (() => {
    const [firstBand, ...otherBands] = params.bands;

    if (!firstBand) {
      return 0;
    }

    let best = firstBand;
    for (const currentBand of otherBands) {
      if (currentBand.zMin < best.zMin) {
        best = currentBand;
      }
    }
    return best.bandIndex;
  })();
  const topojsonSimplify = tileEmitConfig.enableTopojsonSimplify
    ? {
      enabled: true,
      sourceKeys: new Set<string>(),
      toleranceK: resolveToleranceByBand(
        params.buildConfig.geometryConfig.toleranceByBand,
        resolvedTopojsonBandIndex,
        0.1,
      ),
      retryToleranceStep: typeof transformRetryToleranceStep === 'number'
        ? transformRetryToleranceStep
        : 0.02,
      quantize: params.buildConfig.geometryConfig.quantize,
    }
    : undefined;
  const tileEmitHandler = createTileEmitHandler({
    ephemeralDB: params.ephemeralStore,
    tileEmitConfig,
    bands: params.bands,
    geometryEngine,
    abortSignal: tileEmitAbortController.signal,
    continentByCountry,
    topojsonSource: isTopojsonSource,
    topojsonSimplify,
    featureGeojsonByteSizeById,
    tileWriter: async ({
      tileId,
      z,
      x,
      y,
      data,
      layers,
      bufferSetHash,
    }: {
      tileId: number;
      z: number;
      x: number;
      y: number;
      data: ArrayBuffer;
      layers: Record<string, Tile>;
      bufferSetHash: string;
    }) => {
      if (tileEmitAbortController.signal.aborted) {
        throw new DOMException('Tile emit pipeline was aborted', 'AbortError');
      }
      const layerFeatureCounts = Object.entries(layers).map(([name, tile]) => ({
        name,
        featureCount: Array.isArray(tile.features) ? tile.features.length : 0,
      }));
      const featureCount = layerFeatureCounts.reduce((sum, item) => sum + item.featureCount, 0);
      console.info('[ShapeTileEmitTilePersisted]', JSON.stringify({
        nodeId: params.nodeId,
        tileId,
        z,
        x,
        y,
        layerCount: layerFeatureCounts.length,
        featureCount,
        layerFeatureCounts: layerFeatureCounts.sort((a, b) => a.name.localeCompare(b.name)),
      }));
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
  try {
    await runStageTasks<ShapeTileEmitTaskInput>({
      nodeId: params.nodeId,
      stageId: 'tile-emit-stage',
      capability: 'tile-emit',
      handler: tileEmitHandler as StageHandler<ShapeTileEmitTaskInput>,
      waitIfPaused: params.waitIfPaused,
      maxConcurrent: tileEmitConfig.maxConcurrent,
      dynamicConcurrency: tileEmitConfig.dynamicConcurrency?.enabled
        ? {
          ...tileEmitConfig.dynamicConcurrency,
          maxConcurrent: tileEmitConfig.dynamicConcurrency.maxConcurrent ?? tileEmitConfig.maxConcurrent,
        }
        : undefined,
      failureHandling: params.failureHandling,
      abortController: tileEmitAbortController,
    });
  } catch (error) {
    // Handle abort errors specifically
    if (params.abortSignal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      console.log('[ShapeTileEmit][AbortHandling] Tile emit stage aborted via signal', {
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // Handle other errors
    const baseMessage = error instanceof Error ? error.message : String(error);
    const failedTaskId = error && typeof error === 'object'
      ? (error as { taskId?: string }).taskId
      : undefined;
    const reason = failedTaskId ? `${baseMessage} (failedTaskId=${failedTaskId})` : baseMessage;
    
    console.error('[ShapeTileEmit][ErrorHandling] Tile emit stage failed with error', {
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: baseMessage,
      failedTaskId,
    });
    
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'tileEmit',
      `aborted: ${reason}`,
      '[ShapeTileEmit][PipelineDiagnostics] tile-emit stage aborted',
      params.pipelineRunId,
    );
    throw error;
  }

  if (tileEmitAbortController.signal.aborted) {
    return;
  }
  assertTileEmitPipelineActive();
  await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'tileEmit',
    'aborted: tile-emit stage completed with pending tasks',
    '[ShapeTileEmit][PipelineDiagnostics] tile-emit stage finalized pending tasks',
    params.pipelineRunId,
  );
  assertTileEmitPipelineActive();
  console.warn('[ShapeTileEmit][PipelineMetrics] stage tile-emit done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    heap: readHeapSnapshot(),
  }));
  const completedStageCounts = await summarizeStageCounts(
    params.taskQueue,
    params.nodeId,
    'tileEmit',
  );
  assertTileEmitPipelineActive();
  console.warn('[ShapeTileEmit][PipelineDiagnostics] stage tile-emit completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: completedStageCounts,
  }));
  if (params.buildConfig.geometryConfig.deleteOnComplete) {
    assertTileEmitPipelineActive();
    await params.ephemeralStore.geometryCache.where('nodeId').equals(params.nodeId).delete();
    assertTileEmitPipelineActive();
    await params.ephemeralStore.geometryCacheMeta.where('nodeId').equals(params.nodeId).delete();
    assertTileEmitPipelineActive();
  }
};
