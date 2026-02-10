import type { BuildContinuationPolicy, StageHandler, TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata } from '../../common/types/index.js';
import {
  createTransformByBandHandler,
  deleteTasksByIds,
  listTasksByStage,
  putTasks,
  runStageTasks,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import { buildStableSignature } from './taskSignatures.ts';
import type { ShapeTransformByBandTaskInput } from './shapePipelineShared.ts';
import { resolveTransformConfig } from './shapePipelineShared.ts';
import { reconcileStageTasksByMetadata } from './shapeStageReconcile.ts';
import {
  finalizePendingStageTasks,
  getFailedTaskCount,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';
import { clearStagePlan, setTransformPlannedTotal } from './shapeProgressPlan.ts';
import type { HidbEphemeralDB } from '@hierarchidb/gis-sdk';

export type ShapeTransformStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>;
  enableHighDetailBands: boolean;
  countryLookup: Map<string, CountryMetadata>;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  ephemeralStore: HidbEphemeralDB;
  diffBuildEnabled: boolean;
  recyclingAllowlist: Set<string>;
};

type TransformBufferMeta = {
  id: string;
  sourceKey: string;
  adminLevel?: number;
  countryCode?: string;
  featureCount: number;
  inputVertexCount?: number;
  vertexCount?: number;
};

type TransformTaskPreparationSummary = {
  planned: number;
  existing: number;
  missing: number;
};

type TransformStepMemorySnapshot = {
  usedJSHeapSize: number | null;
  totalJSHeapSize: number | null;
  jsHeapSizeLimit: number | null;
};

const TRANSFORM_TASK_PUT_CHUNK_SIZE = 500;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readString = (value: unknown): string | null => (
  typeof value === 'string' ? value : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const toMemoryValue = (value: number | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const captureTransformStepMemorySnapshot = (): TransformStepMemorySnapshot => {
  const memory = (
    globalThis as {
      performance?: {
        memory?: {
          usedJSHeapSize?: number;
          totalJSHeapSize?: number;
          jsHeapSizeLimit?: number;
        };
      };
    }
  ).performance?.memory;
  return {
    usedJSHeapSize: toMemoryValue(memory?.usedJSHeapSize),
    totalJSHeapSize: toMemoryValue(memory?.totalJSHeapSize),
    jsHeapSizeLimit: toMemoryValue(memory?.jsHeapSizeLimit),
  };
};

const subtractMemoryValue = (start: number | null, finish: number | null): number | null => {
  if (start === null || finish === null) return null;
  return finish - start;
};

const calculateMemoryDelta = (
  start: TransformStepMemorySnapshot,
  finish: TransformStepMemorySnapshot,
): TransformStepMemorySnapshot => ({
  usedJSHeapSize: subtractMemoryValue(start.usedJSHeapSize, finish.usedJSHeapSize),
  totalJSHeapSize: subtractMemoryValue(start.totalJSHeapSize, finish.totalJSHeapSize),
  jsHeapSizeLimit: subtractMemoryValue(start.jsHeapSizeLimit, finish.jsHeapSizeLimit),
});

const runTransformStep = async <T>(
  params: ShapeTransformStageParams,
  step: string,
  action: () => Promise<T>,
): Promise<T> => {
  const startedAt = Date.now();
  const memoryAtStart = captureTransformStepMemorySnapshot();
  console.warn('[ShapeTransform][Transition] step start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    step,
    startedAt,
    memoryAtStart,
  }));
  try {
    const result = await action();
    const finishedAt = Date.now();
    const memoryAtFinish = captureTransformStepMemorySnapshot();
    console.warn('[ShapeTransform][Transition] step finish', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      step,
      outcome: 'success',
      startedAt,
      finishedAt,
      elapsedMs: finishedAt - startedAt,
      memoryAtStart,
      memoryAtFinish,
      memoryDelta: calculateMemoryDelta(memoryAtStart, memoryAtFinish),
    }));
    return result;
  } catch (error) {
    const finishedAt = Date.now();
    const memoryAtFinish = captureTransformStepMemorySnapshot();
    console.warn('[ShapeTransform][Transition] step finish', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      step,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      startedAt,
      finishedAt,
      elapsedMs: finishedAt - startedAt,
      memoryAtStart,
      memoryAtFinish,
      memoryDelta: calculateMemoryDelta(memoryAtStart, memoryAtFinish),
    }));
    throw error;
  }
};

export const runShapeTransformStageSection = async (params: ShapeTransformStageParams): Promise<boolean> => {
  console.warn('[ShapeTransform][PipelineDiagnostics] transform stage start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks: params.resumeExistingTasks,
    maxConcurrent: params.buildConfig.transformConfig.maxConcurrent,
    geometryEngine: params.buildConfig.transformConfig.geometryEngine ?? 'turf',
    bands: params.bands.length,
  }));
  let existingTransformByBandTasks = params.resumeExistingTasks
    ? await runTransformStep(params, 'load-existing-transform-tasks', async () => (
      listTasksByStage(params.taskQueue, params.nodeId, 'transform')
    ))
    : [];
  const transformConfig = resolveTransformConfig(params.buildConfig);
  const transformConfigSignature = buildStableSignature(transformConfig);
  const bandsAscending = [...params.bands].sort((a, b) => a.zMax - b.zMax);

  const fetchTasks = await runTransformStep(params, 'load-fetch-stage-tasks', async () => (
    listTasksByStage(params.taskQueue, params.nodeId, 'fetch')
  ));
  console.warn('[ShapeTransform][PipelineDiagnostics] transform stage fetched inputs', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    fetchTasks: fetchTasks.length,
    existingTransformTasks: existingTransformByBandTasks.length,
  }));
  const buffers = await runTransformStep(params, 'build-transform-buffer-metadata', async () => {
    const next: TransformBufferMeta[] = [];
    fetchTasks.forEach((task) => {
      const output = isRecord(task.outputData) ? task.outputData : null;
      const fetchCacheId = readString(output?.fetchCacheId);
      if (!fetchCacheId) return;
      const input = isRecord(task.inputData) ? task.inputData : null;
      const sourceKey = readString(input?.sourceKey);
      if (!sourceKey) return;
      next.push({
        id: fetchCacheId,
        sourceKey,
        adminLevel: readNumber(input?.adminLevel) ?? undefined,
        countryCode: readString(input?.countryCode) ?? undefined,
        featureCount: readNumber(output?.featureCount) ?? 0,
        inputVertexCount: readNumber(output?.vertexCount) ?? undefined,
        vertexCount: readNumber(output?.vertexCount) ?? undefined,
      });
    });
    return next;
  });
  if (buffers.length === 0) {
    console.warn('[ShapeTransform][PipelineDiagnostics] transform stage skipped (no buffers)', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
    }));
    return false;
  }

  const { buffersByCountry, orderedCountries } = await runTransformStep(params, 'group-buffers-by-country', async () => {
    const countryTotals = new Map<string, number>();
    const grouped = new Map<string, TransformBufferMeta[]>();
    buffers.forEach((buffer) => {
      const countryKey = buffer.countryCode?.trim().toUpperCase() ?? buffer.sourceKey;
      const currentTotal = countryTotals.get(countryKey) ?? 0;
      const vertexCount = buffer.inputVertexCount ?? buffer.vertexCount ?? 0;
      countryTotals.set(countryKey, currentTotal + vertexCount);
      const bucket = grouped.get(countryKey);
      if (bucket) {
        bucket.push(buffer);
      } else {
        grouped.set(countryKey, [buffer]);
      }
    });
    const sortedCountries = [...grouped.keys()].sort((a, b) => {
      const totalA = countryTotals.get(a) ?? 0;
      const totalB = countryTotals.get(b) ?? 0;
      if (totalA !== totalB) return totalB - totalA;
      const nameA = params.countryLookup.get(a)?.countryName ?? a;
      const nameB = params.countryLookup.get(b)?.countryName ?? b;
      return nameA.localeCompare(nameB);
    });
    return {
      buffersByCountry: grouped,
      orderedCountries: sortedCountries,
    };
  });

  const buildTasksForCountryBand = (
    countryKey: string,
    countryIndex: number,
    band: { bandIndex: number; zMin: number; zMax: number },
    startIndex: number,
  ): { tasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>; nextIndex: number } => {
    const countryBuffers = buffersByCountry.get(countryKey) ?? [];
    if (countryBuffers.length === 0) {
      return { tasks: [], nextIndex: startIndex };
    }
    countryBuffers.sort((a, b) => {
      const adminA = typeof a.adminLevel === 'number' ? a.adminLevel : 0;
      const adminB = typeof b.adminLevel === 'number' ? b.adminLevel : 0;
      if (adminA !== adminB) return adminA - adminB;
      return a.sourceKey.localeCompare(b.sourceKey);
    });
    const countryName = params.countryLookup.get(countryKey)?.countryName;
    const tasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
    let index = startIndex;
    for (const buffer of countryBuffers) {
      if (band.zMin >= 9) {
        if (!params.enableHighDetailBands) {
          continue;
        }
        if (typeof buffer.adminLevel !== 'number' || buffer.adminLevel < 2) {
          continue;
        }
      }
      tasks.push({
        taskId: `${String(params.nodeId)}:transform:${band.bandIndex}:${buffer.sourceKey}`,
        nodeId: params.nodeId,
        stage: 'transform',
        status: 'queued',
        index,
        stagePriority: countryIndex,
        progress: 0,
        inputData: {
          fetchCacheId: buffer.id,
          bandIndex: band.bandIndex,
          bandMinZoom: band.zMin,
          bandMaxZoom: band.zMax,
          domainType: 'shape',
          sourceKey: buffer.sourceKey,
          stagePriority: countryIndex,
          countryCode: buffer.countryCode?.trim().toUpperCase(),
          countryName,
          adminLevel: buffer.adminLevel,
          configSignature: transformConfigSignature,
        },
      });
      index += 1;
    }
    return { tasks, nextIndex: index };
  };

  try {
    let preparation: TransformTaskPreparationSummary;
    if (!params.resumeExistingTasks) {
      preparation = await runTransformStep(params, 'prepare-transform-tasks-chunked', async () => {
        let nextIndex = 0;
        let planned = 0;
        let missing = 0;
        const taskChunk: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
        const flushChunk = async () => {
          if (taskChunk.length === 0) return;
          const chunk = [...taskChunk];
          taskChunk.length = 0;
          await putTasks(params.taskQueue, chunk);
        };
        for (const [countryIndex, countryKey] of orderedCountries.entries()) {
          for (const band of bandsAscending) {
            const { tasks, nextIndex: updatedIndex } = buildTasksForCountryBand(
              countryKey,
              countryIndex,
              band,
              nextIndex,
            );
            nextIndex = updatedIndex;
            if (tasks.length === 0) continue;
            planned += tasks.length;
            missing += tasks.length;
            for (const task of tasks) {
              taskChunk.push(task);
              if (taskChunk.length >= TRANSFORM_TASK_PUT_CHUNK_SIZE) {
                await flushChunk();
              }
            }
          }
        }
        await flushChunk();
        return { planned, existing: 0, missing };
      });
    } else {
      const desiredTransformTasks = await runTransformStep(params, 'build-desired-transform-tasks', async () => {
        const desired: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
        let nextIndex = 0;
        orderedCountries.forEach((countryKey, countryIndex) => {
          bandsAscending.forEach((band) => {
            const { tasks, nextIndex: updatedIndex } = buildTasksForCountryBand(
              countryKey,
              countryIndex,
              band,
              nextIndex,
            );
            if (tasks.length > 0) {
              desired.push(...tasks);
            }
            nextIndex = updatedIndex;
          });
        });
        return desired;
      });
      preparation = await runTransformStep(params, 'reconcile-transform-tasks', async () => {
        let missingTransformTasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
        if (existingTransformByBandTasks.length > 0) {
          const reconciled = reconcileStageTasksByMetadata(desiredTransformTasks, existingTransformByBandTasks);
          if (reconciled.obsoleteTaskIds.length > 0) {
            await deleteTasksByIds(params.taskQueue, reconciled.obsoleteTaskIds);
          }
          const obsoleteSet = new Set(reconciled.obsoleteTaskIds);
          existingTransformByBandTasks = existingTransformByBandTasks.filter((task) => !obsoleteSet.has(task.taskId));
          missingTransformTasks = reconciled.missingTasks as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
        } else {
          missingTransformTasks = desiredTransformTasks;
        }
        if (missingTransformTasks.length > 0) {
          await putTasks(params.taskQueue, missingTransformTasks);
        }
        return {
          planned: desiredTransformTasks.length,
          existing: existingTransformByBandTasks.length,
          missing: missingTransformTasks.length,
        };
      });
    }
    if (preparation.planned > 0) {
      setTransformPlannedTotal(params.nodeId, preparation.planned);
    } else {
      clearStagePlan(params.nodeId);
    }
    console.warn('[ShapeTransform][PipelineDiagnostics] transform stage tasks prepared', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      planned: preparation.planned,
      existing: preparation.existing,
      missing: preparation.missing,
    }));
    if (preparation.planned === 0 || (preparation.existing === 0 && preparation.missing === 0)) {
      return false;
    }

    await runTransformStep(params, 'wait-if-paused-before-transform', async () => {
      await params.waitIfPaused?.();
    });
    await runTransformStep(params, 'reset-running-transform-tasks', async () => {
      await resetStageRunningTasks(params.taskQueue, params.nodeId, 'transform');
    });

    const transformByBandAbortController = new AbortController();
    const transformByBandHandler = await runTransformStep(params, 'create-transform-handler', async () => (
      createTransformByBandHandler({
        ephemeralDB: params.ephemeralStore,
        transformConfig,
        bands: params.bands,
        featureIdAllowlist: params.diffBuildEnabled ? params.recyclingAllowlist : undefined,
        abortSignal: transformByBandAbortController.signal,
      })
    ));
    try {
      await runTransformStep(params, 'run-transform-stage-tasks', async () => {
        await runStageTasks({
          nodeId: params.nodeId,
          stage: 'transform',
          handler: transformByBandHandler as unknown as StageHandler<ShapeTransformByBandTaskInput>,
          waitIfPaused: params.waitIfPaused,
          maxConcurrent: params.buildConfig.transformConfig.maxConcurrent,
          failureHandling: params.failureHandling,
          abortController: transformByBandAbortController,
        });
      });
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : String(error);
      const failedTaskId = error && typeof error === 'object'
        ? (error as { taskId?: string }).taskId
        : undefined;
      const reason = failedTaskId ? `${baseMessage} (failedTaskId=${failedTaskId})` : baseMessage;
      await finalizePendingStageTasks(
        params.taskQueue,
        params.nodeId,
        'transform',
        `aborted: ${reason}`,
        '[ShapeTransform][PipelineDiagnostics] transform stage aborted',
        params.pipelineRunId,
      );
      throw error;
    }

    console.warn('[ShapeTransform][PipelineDiagnostics] stage transform completed', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'transform'),
    }));
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'transform',
      'aborted: transform stage completed with pending tasks',
      '[ShapeTransform][PipelineDiagnostics] transform stage finalized pending tasks',
      params.pipelineRunId,
    );
    const shouldStop = shouldStopAfterStage(
      params.buildContinuationPolicy,
      await runTransformStep(params, 'count-failed-transform-tasks', async () => (
        getFailedTaskCount(params.taskQueue, params.nodeId, 'transform')
      )),
    );
    if (params.buildConfig.fetchConfig.deleteOnComplete) {
      await runTransformStep(params, 'cleanup-fetch-cache-after-transform', async () => {
        await params.ephemeralStore.transaction('rw', params.ephemeralStore.fetchCache, async () => {
          await params.ephemeralStore.fetchCache.where('nodeId').equals(params.nodeId).delete();
        });
      });
    }
    return shouldStop;
  } finally {
    clearStagePlan(params.nodeId);
  }
};
