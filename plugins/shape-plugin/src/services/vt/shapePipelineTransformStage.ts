import type { BuildContinuationPolicy, StageHandler, TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata } from '../../common/types/index.js';
import { createTransformByBandHandler, listTasksByStage, putTasks, runStageTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { buildStableSignature } from './taskSignatures.ts';
import type { ShapeTransformByBandTaskInput } from './shapePipelineShared.ts';
import {
  filterObsoleteTasks,
  resolveTransformConfig,
} from './shapePipelineShared.ts';
import {
  finalizePendingStageTasks,
  getFailedTaskCount,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';
import { clearStagePlan, setTransformPlannedTotal } from './shapeProgressPlan.ts';
import { initGeos, type HidbEphemeralDB } from '@hierarchidb/gis-sdk';

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


const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readString = (value: unknown): string | null => (
  typeof value === 'string' ? value : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const runShapeTransformStageSection = async (params: ShapeTransformStageParams): Promise<boolean> => {
  let existingTransformByBandTasks = params.resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'transform')
    : [];
  const transformConfig = resolveTransformConfig(params.buildConfig);
  const transformConfigSignature = buildStableSignature(transformConfig);
  const bandsAscending = [...params.bands].sort((a, b) => a.zMax - b.zMax);

  const fetchTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'fetch');
  const buffers: TransformBufferMeta[] = [];
  fetchTasks.forEach((task) => {
    const output = isRecord(task.outputData) ? task.outputData : null;
    const fetchCacheId = readString(output?.fetchCacheId);
    if (!fetchCacheId) return;
    const input = isRecord(task.inputData) ? task.inputData : null;
    const sourceKey = readString(input?.sourceKey);
    if (!sourceKey) return;
    buffers.push({
      id: fetchCacheId,
      sourceKey,
      adminLevel: readNumber(input?.adminLevel) ?? undefined,
      countryCode: readString(input?.countryCode) ?? undefined,
      featureCount: readNumber(output?.featureCount) ?? 0,
      inputVertexCount: readNumber(output?.vertexCount) ?? undefined,
      vertexCount: readNumber(output?.vertexCount) ?? undefined,
    });
  });
  if (buffers.length === 0) {
    return false;
  }

  const countryTotals = new Map<string, number>();
  const buffersByCountry = new Map<string, TransformBufferMeta[]>();
  buffers.forEach((buffer) => {
    const countryKey = buffer.countryCode?.trim().toUpperCase() ?? buffer.sourceKey;
    const currentTotal = countryTotals.get(countryKey) ?? 0;
    const vertexCount = buffer.inputVertexCount ?? buffer.vertexCount ?? 0;
    countryTotals.set(countryKey, currentTotal + vertexCount);
    const bucket = buffersByCountry.get(countryKey);
    if (bucket) {
      bucket.push(buffer);
    } else {
      buffersByCountry.set(countryKey, [buffer]);
    }
  });

  const orderedCountries = [...buffersByCountry.keys()].sort((a, b) => {
    const totalA = countryTotals.get(a) ?? 0;
    const totalB = countryTotals.get(b) ?? 0;
    if (totalA !== totalB) return totalB - totalA;
    const nameA = params.countryLookup.get(a)?.countryName ?? a;
    const nameB = params.countryLookup.get(b)?.countryName ?? b;
    return nameA.localeCompare(nameB);
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

  const desiredTransformTasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
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
        desiredTransformTasks.push(...tasks);
      }
      nextIndex = updatedIndex;
    });
  });

  const plannedTransformTotal = desiredTransformTasks.length;
  if (plannedTransformTotal > 0) {
    setTransformPlannedTotal(params.nodeId, plannedTransformTotal);
  } else {
    clearStagePlan(params.nodeId);
  }

  try {
    if (params.resumeExistingTasks && existingTransformByBandTasks.length > 0) {
      existingTransformByBandTasks = await filterObsoleteTasks(
        params.taskQueue,
        existingTransformByBandTasks,
        desiredTransformTasks,
      );
    }
    const existingIds = new Set(existingTransformByBandTasks.map((task) => task.taskId));
    const missingTransformTasks = desiredTransformTasks.filter((task) => !existingIds.has(task.taskId));
    if (missingTransformTasks.length > 0) {
      await putTasks(params.taskQueue, missingTransformTasks);
    }
    if (existingTransformByBandTasks.length === 0 && missingTransformTasks.length === 0) {
      return false;
    }

    await params.waitIfPaused?.();
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'transform');

    if (transformConfig.geometryEngine === 'geos') {
      await initGeos();
    }

    const transformByBandAbortController = new AbortController();
    const transformByBandHandler = createTransformByBandHandler({
      ephemeralDB: params.ephemeralStore,
      transformConfig,
      bands: params.bands,
      featureIdAllowlist: params.diffBuildEnabled ? params.recyclingAllowlist : undefined,
      abortSignal: transformByBandAbortController.signal,
    });
    try {
      await runStageTasks({
        nodeId: params.nodeId,
        stage: 'transform',
        handler: transformByBandHandler as unknown as StageHandler<ShapeTransformByBandTaskInput>,
        waitIfPaused: params.waitIfPaused,
        maxConcurrent: params.buildConfig.transformConfig.maxConcurrent,
        failureHandling: params.failureHandling,
        abortController: transformByBandAbortController,
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
      await getFailedTaskCount(params.taskQueue, params.nodeId, 'transform'),
    );
    if (params.buildConfig.fetchConfig.deleteOnComplete) {
      await params.ephemeralStore.transaction('rw', params.ephemeralStore.fetchCache, async () => {
        await params.ephemeralStore.fetchCache.where('nodeId').equals(params.nodeId).delete();
      });
    }
    return shouldStop;
  } finally {
    clearStagePlan(params.nodeId);
  }
};
