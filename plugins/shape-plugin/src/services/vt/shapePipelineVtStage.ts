import type { StageHandler, TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import { createVtHandler, listTasksByStage, listTasksByStageAndStatus, putTasks, runStageTasks, updateTask, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import { buildStableSignature } from './taskSignatures.ts';
import type { ShapeVtTaskInput } from './shapePipelineShared.ts';
import {
  buildShapeVectorTileRecord,
  buildVtTasks,
  filterObsoleteTasks,
  resolveVtConfig,
} from './shapePipelineShared.ts';
import {
  finalizePendingStageTasks,
  readHeapSnapshot,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';
import type { ephemeralShapeDB } from '@hierarchidb/shape-store';

export type ShapeVtStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>;
  enableHighDetailBands: boolean;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  pipelineRunId?: string;
  ephemeralStore: typeof ephemeralShapeDB;
  loadContinentLookup: () => Promise<Map<string, string>>;
};

export const runShapeVtStageSection = async (params: ShapeVtStageParams): Promise<void> => {
  const vtConfig = resolveVtConfig(params.buildConfig);
  let existingVtTasks = params.resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'vt')
    : [];
  const vtConfigSignature = buildStableSignature(vtConfig);
  const desiredVtTasks = await buildVtTasks(
    params.nodeId,
    params.ephemeralStore,
    params.bands,
    params.enableHighDetailBands,
    vtConfigSignature,
  );
  if (params.resumeExistingTasks && existingVtTasks.length > 0) {
    existingVtTasks = await filterObsoleteTasks(params.taskQueue, existingVtTasks, desiredVtTasks);
  }
  if (params.resumeExistingTasks && existingVtTasks.length > 0) {
    const runningVtTasks = await listTasksByStageAndStatus(params.taskQueue, params.nodeId, 'vt', 'running');
    if (runningVtTasks.length > 0) {
      await Promise.all(runningVtTasks.map((task) => (
        updateTask(params.taskQueue, task.taskId, {
          status: 'failed',
          errorMessage: 'aborted: resume cleared running vt task',
          completedAt: Date.now(),
        })
      )));
    }
  }
  let missingVtTasks: Array<TaskQueueRecord<ShapeVtTaskInput>> = [];
  if (params.resumeExistingTasks) {
    const existingIds = new Set(existingVtTasks.map((task) => task.taskId));
    missingVtTasks = desiredVtTasks.filter((task) => !existingIds.has(task.taskId)) as Array<TaskQueueRecord<ShapeVtTaskInput>>;
    if (missingVtTasks.length > 0) {
      await putTasks(params.taskQueue, missingVtTasks);
    }
  } else {
    missingVtTasks = desiredVtTasks as Array<TaskQueueRecord<ShapeVtTaskInput>>;
    if (missingVtTasks.length > 0) {
      await putTasks(params.taskQueue, missingVtTasks);
    }
  }
  console.warn('[ShapeVt][PipelineMetrics] vt task prep', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    existingTaskCount: existingVtTasks.length,
    newTaskCount: missingVtTasks.length,
  }));
  if (existingVtTasks.length === 0 && missingVtTasks.length === 0) {
    return;
  }
  await params.waitIfPaused?.();
  console.warn('[ShapeVt][PipelineMetrics] vt queue snapshot', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'vt'),
  }));
  console.warn('[ShapeVt][PipelineMetrics] stage vt start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    bands: params.bands.length,
    heap: readHeapSnapshot(),
  }));
  const vtAbortController = new AbortController();
  const continentByCountry = params.bands.some((band) => band.zMin === 0)
    ? await params.loadContinentLookup()
    : undefined;
  const vtHandler = createVtHandler({
    ephemeralDB: params.ephemeralStore,
    vtConfig,
    bands: params.bands,
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
    failureHandling: params.failureHandling,
    abortController: vtAbortController,
  });
  await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'vt',
    'aborted: vt stage completed with pending tasks',
    '[ShapeVt][PipelineDiagnostics] vt stage finalized pending tasks',
    params.pipelineRunId,
  );
  console.warn('[ShapeVt][PipelineMetrics] stage vt done', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    heap: readHeapSnapshot(),
  }));
  console.warn('[ShapeTransform][PipelineDiagnostics] stage vt completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'vt'),
  }));
  if (params.buildConfig.transformConfig.deleteOnComplete) {
    await params.ephemeralStore.transaction('rw', params.ephemeralStore.transformCache, async () => {
      await params.ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
    });
  }
};
