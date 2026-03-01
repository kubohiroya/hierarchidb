import type { BuildContinuationPolicy, StageHandler, TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import type { CountryMetadata } from '~/common/types/index';
import {
  createTransformByBandHandler,
  deleteTasksByIds,
  listTasksByStage,
  putTasks,
  runStageTasks,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import { buildStableSignature } from './taskSignatures.ts';
import type { ShapeGeometryByBandTaskInput } from './shapePipelineShared.ts';
import { resolveGeometryConfig } from './shapePipelineShared.ts';
import { reconcileStageTasksByMetadata } from './shapeStageReconcile.ts';
import {
  finalizePendingStageTasks,
  getFailedTaskCount,
  markStageTasksRecycled,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';
import { clearStagePlan, setGeometryPlannedTotal } from './shapeProgressPlan.ts';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import { buildGeometryTaskCacheIdentity } from './shapeTaskCacheIdentity.ts';
import { resolveSourceArtifactHashById } from './shapeSourceArtifactHash.ts';

export type ShapeGeometryStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  bands: Array<{ bandIndex: number; zMin: number; zMax: number; zBase: number }>;
  enableHighDetailBands: boolean;
  countryLookup: Map<string, CountryMetadata>;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  ephemeralStore: EphemeralDB;
  diffBuildEnabled: boolean;
  recyclingAllowlist: Set<string>;
};

type GeometryBufferMeta = {
  id: string;
  sourceKey: string;
  sourceArtifactHash: string;
  sourceCacheFormat?: 'flatgeobuf' | 'topojson';
  sourceCacheCompression?: 'gzip' | 'none';
  adminLevel?: number;
  countryCode?: string;
  dataSource?: string;
  sourceUrl?: string;
  sourceCountryCode?: string;
  featureCount: number;
  inputPolygonCount?: number;
  polygonCount?: number;
  inputVertexCount?: number;
  vertexCount?: number;
};

type GeometryTaskPreparationSummary = {
  planned: number;
  existing: number;
  missing: number;
};

type GeometryStepMemorySnapshot = {
  usedJSHeapSize: number | null;
  totalJSHeapSize: number | null;
  jsHeapSizeLimit: number | null;
};

const GEOMETRY_TASK_PUT_CHUNK_SIZE = 500;
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

const captureGeometryStepMemorySnapshot = (): GeometryStepMemorySnapshot => {
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
  start: GeometryStepMemorySnapshot,
  finish: GeometryStepMemorySnapshot,
): GeometryStepMemorySnapshot => ({
  usedJSHeapSize: subtractMemoryValue(start.usedJSHeapSize, finish.usedJSHeapSize),
  totalJSHeapSize: subtractMemoryValue(start.totalJSHeapSize, finish.totalJSHeapSize),
  jsHeapSizeLimit: subtractMemoryValue(start.jsHeapSizeLimit, finish.jsHeapSizeLimit),
});

const runGeometryStep = async <T>(
  params: ShapeGeometryStageParams,
  step: string,
  action: () => Promise<T>,
): Promise<T> => {
  const startedAt = Date.now();
  const memoryAtStart = captureGeometryStepMemorySnapshot();
  console.warn('[ShapeGeometry][Transition] step start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    step,
    startedAt,
    memoryAtStart,
  }));
  try {
    const result = await action();
    const finishedAt = Date.now();
    const memoryAtFinish = captureGeometryStepMemorySnapshot();
    console.warn('[ShapeGeometry][Transition] step finish', JSON.stringify({
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
    const memoryAtFinish = captureGeometryStepMemorySnapshot();
    console.warn('[ShapeGeometry][Transition] step finish', JSON.stringify({
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

export const runShapeGeometryStageSection = async (params: ShapeGeometryStageParams): Promise<boolean> => {
  console.warn('[ShapeGeometry][PipelineDiagnostics] geometry stage start', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    resumeExistingTasks: params.resumeExistingTasks,
    maxConcurrent: params.buildConfig.geometryConfig.maxConcurrent,
    geometryEngine: params.buildConfig.geometryConfig.geometryEngine ?? 'turf',
    bands: params.bands.length,
  }));
  let existingGeometryByBandTasks = params.resumeExistingTasks
    ? await runGeometryStep(params, 'load-existing-geometry-tasks', async () => (
      listTasksByStage(params.taskQueue, params.nodeId, 'geometry')
    ))
    : [];
  const geometryConfig = resolveGeometryConfig(params.buildConfig);
  const geometryConfigSignature = buildStableSignature(geometryConfig);
  const bandsAscending = [...params.bands].sort((a, b) => a.zMax - b.zMax);

  const fetchTasks = await runGeometryStep(params, 'load-source-stage-tasks', async () => (
    listTasksByStage(params.taskQueue, params.nodeId, 'source')
  ));
  console.warn('[ShapeGeometry][PipelineDiagnostics] geometry stage source inputs loaded', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    fetchTasks: fetchTasks.length,
    existingGeometryTasks: existingGeometryByBandTasks.length,
  }));
  const buffers = await runGeometryStep(params, 'build-geometry-buffer-metadata', async () => {
    const next: GeometryBufferMeta[] = [];
    for (const task of fetchTasks) {
      const output = isRecord(task.outputData) ? task.outputData : null;
      const sourceCacheId = readString(output?.sourceCacheId);
      if (!sourceCacheId) continue;
      const sourceArtifactHash = readString(output?.sourceArtifactHash)
        ?? await resolveSourceArtifactHashById(params.ephemeralStore, sourceCacheId);
      if (!sourceArtifactHash) continue;
      const input = isRecord(task.inputData) ? task.inputData : null;
      const sourceKey = readString(input?.sourceKey);
      if (!sourceKey) continue;
      const preview = isRecord(task.metadata?.preview) ? task.metadata.preview : null;
      const sourceCacheFormat = readString(preview?.sourceCacheFormat);
      const sourceCacheCompression = readString(preview?.sourceCacheCompression);
      next.push({
        id: sourceCacheId,
        sourceKey,
        sourceArtifactHash,
        sourceCacheFormat: sourceCacheFormat === 'topojson' ? 'topojson' : 'flatgeobuf',
        sourceCacheCompression: sourceCacheCompression === 'gzip' ? 'gzip' : 'none',
        adminLevel: readNumber(input?.adminLevel) ?? undefined,
        countryCode: readString(input?.countryCode) ?? undefined,
        dataSource: readString(input?.dataSource) ?? undefined,
        sourceUrl: readString(input?.url) ?? undefined,
        sourceCountryCode: readString(input?.urlCountryCode) ?? readString(input?.countryCode) ?? undefined,
        featureCount: readNumber(output?.featureCount) ?? 0,
        inputPolygonCount: readNumber(output?.polygonCount) ?? undefined,
        polygonCount: readNumber(output?.polygonCount) ?? undefined,
        inputVertexCount: readNumber(output?.vertexCount) ?? undefined,
        vertexCount: readNumber(output?.vertexCount) ?? undefined,
      });
    }
    return next;
  });
  if (buffers.length === 0) {
    console.warn('[ShapeGeometry][PipelineDiagnostics] geometry stage skipped (no buffers)', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
    }));
    return false;
  }

  const { buffersByCountry, orderedCountries } = await runGeometryStep(params, 'group-buffers-by-country', async () => {
    const countryTotals = new Map<string, number>();
    const grouped = new Map<string, GeometryBufferMeta[]>();
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
  ): { tasks: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>>; nextIndex: number } => {
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
    const tasks: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>> = [];
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
      const cacheIdentity = buildGeometryTaskCacheIdentity({
        nodeId: params.nodeId,
        sourceKey: buffer.sourceKey,
        bandIndex: band.bandIndex,
        sourceArtifactHash: buffer.sourceArtifactHash,
        bandMinZoom: band.zMin,
        bandMaxZoom: band.zMax,
        configSignature: geometryConfigSignature,
      });
      tasks.push({
        taskId: `${String(params.nodeId)}:geometry:${band.bandIndex}:${buffer.sourceKey}`,
        nodeId: params.nodeId,
        stage: 'geometry',
        status: 'queued',
        index,
        stagePriority: countryIndex,
        progress: 0,
        inputData: {
          sourceCacheId: buffer.id,
          sourceArtifactHash: buffer.sourceArtifactHash,
          sourceCacheFormat: buffer.sourceCacheFormat,
          sourceCacheCompression: buffer.sourceCacheCompression,
          bandIndex: band.bandIndex,
          bandMinZoom: band.zMin,
          bandMaxZoom: band.zMax,
          inputPolygonCount: buffer.inputPolygonCount ?? buffer.polygonCount,
          inputVertexCount: buffer.inputVertexCount ?? buffer.vertexCount,
          domainType: 'shape',
          sourceKey: buffer.sourceKey,
          stagePriority: countryIndex,
          countryCode: buffer.countryCode?.trim().toUpperCase(),
          countryName,
          adminLevel: buffer.adminLevel,
          dataSource: buffer.dataSource,
          sourceUrl: buffer.sourceUrl,
          sourceCountryCode: buffer.sourceCountryCode,
          configSignature: geometryConfigSignature,
          cacheKey: cacheIdentity.cacheKey,
          inputHash: cacheIdentity.inputHash,
        },
      });
      index += 1;
    }
    return { tasks, nextIndex: index };
  };

  try {
    let preparation: GeometryTaskPreparationSummary;
    if (!params.resumeExistingTasks) {
      preparation = await runGeometryStep(params, 'prepare-geometry-tasks-chunked', async () => {
        let nextIndex = 0;
        let planned = 0;
        let missing = 0;
        const taskChunk: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>> = [];
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
              if (taskChunk.length >= GEOMETRY_TASK_PUT_CHUNK_SIZE) {
                await flushChunk();
              }
            }
          }
        }
        await flushChunk();
        return { planned, existing: 0, missing };
      });
    } else {
      const desiredGeometryTasks = await runGeometryStep(params, 'build-desired-geometry-tasks', async () => {
        const desired: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>> = [];
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
      preparation = await runGeometryStep(params, 'reconcile-geometry-tasks', async () => {
        let missingGeometryTasks: Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>>;
        if (existingGeometryByBandTasks.length > 0) {
          const reconciled = reconcileStageTasksByMetadata(desiredGeometryTasks, existingGeometryByBandTasks);
          if (reconciled.obsoleteTaskIds.length > 0) {
            await deleteTasksByIds(params.taskQueue, reconciled.obsoleteTaskIds);
          }
          const obsoleteSet = new Set(reconciled.obsoleteTaskIds);
          existingGeometryByBandTasks = existingGeometryByBandTasks.filter((task) => !obsoleteSet.has(task.taskId));
          missingGeometryTasks = reconciled.missingTasks as Array<TaskQueueRecord<ShapeGeometryByBandTaskInput>>;
        } else {
          missingGeometryTasks = desiredGeometryTasks;
        }
        if (missingGeometryTasks.length > 0) {
          await putTasks(params.taskQueue, missingGeometryTasks);
        }
        return {
          planned: desiredGeometryTasks.length,
          existing: existingGeometryByBandTasks.length,
          missing: missingGeometryTasks.length,
        };
      });
    }
    if (preparation.planned > 0) {
      setGeometryPlannedTotal(params.nodeId, preparation.planned);
    } else {
      clearStagePlan(params.nodeId);
    }
    console.warn('[ShapeGeometry][PipelineDiagnostics] geometry stage tasks prepared', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      planned: preparation.planned,
      existing: preparation.existing,
      missing: preparation.missing,
    }));
    if (preparation.planned === 0 || (preparation.existing === 0 && preparation.missing === 0)) {
      return false;
    }

    await runGeometryStep(params, 'wait-if-paused-before-geometry', async () => {
      await params.waitIfPaused?.();
    });
    await runGeometryStep(params, 'reset-running-geometry-tasks', async () => {
      await resetStageRunningTasks(params.taskQueue, params.nodeId, 'geometry');
    });
    if (params.resumeExistingTasks) {
      await runGeometryStep(params, 'mark-recycled-geometry-tasks', async () => {
        await markStageTasksRecycled(params.taskQueue, params.nodeId, 'geometry');
      });
    }

    const geometryByBandAbortController = new AbortController();
    const geometryByBandHandler = await runGeometryStep(params, 'create-geometry-handler', async () => (
      createTransformByBandHandler({
        ephemeralDB: params.ephemeralStore,
        geometryConfig,
        bands: params.bands,
        featureIdAllowlist: params.diffBuildEnabled ? params.recyclingAllowlist : undefined,
        abortSignal: geometryByBandAbortController.signal,
      })
    ));
    try {
      await runGeometryStep(params, 'run-geometry-stage-tasks', async () => {
        await runStageTasks<ShapeGeometryByBandTaskInput>({
          nodeId: params.nodeId,
          stageId: 'geometry-stage',
          capability: 'geometry',
          handler: geometryByBandHandler as StageHandler<ShapeGeometryByBandTaskInput>,
          waitIfPaused: params.waitIfPaused,
          maxConcurrent: params.buildConfig.geometryConfig.maxConcurrent,
          failureHandling: params.failureHandling,
          abortController: geometryByBandAbortController,
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
        'geometry',
        `aborted: ${reason}`,
        '[ShapeGeometry][PipelineDiagnostics] geometry stage aborted',
        params.pipelineRunId,
      );
      throw error;
    }

    console.warn('[ShapeGeometry][PipelineDiagnostics] stage geometry completed', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'geometry'),
    }));
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'geometry',
      'aborted: geometry stage completed with pending tasks',
      '[ShapeGeometry][PipelineDiagnostics] geometry stage finalized pending tasks',
      params.pipelineRunId,
    );
    const shouldStop = shouldStopAfterStage(
      params.buildContinuationPolicy,
      await runGeometryStep(params, 'count-failed-geometry-tasks', async () => (
        getFailedTaskCount(params.taskQueue, params.nodeId, 'geometry')
      )),
    );
    if (params.buildConfig.sourceConfig.deleteOnComplete) {
      await runGeometryStep(params, 'cleanup-source-cache-after-geometry', async () => {
        await params.ephemeralStore.sourceCache.where('nodeId').equals(params.nodeId).delete();
        await params.ephemeralStore.sourceCacheMeta.where('nodeId').equals(params.nodeId).delete();
      });
    }
    return shouldStop;
  } finally {
    clearStagePlan(params.nodeId);
  }
};
