import type { BuildContinuationPolicy, StageHandler, TaskQueueRecord } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import type { CountryMetadata } from '../../common/types/index.js';
import { createTransformByBandHandler, listTasksByStage, putTasks, runStageTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { buildStableSignature } from './taskSignatures.ts';
import type { ShapeTransformByBandTaskInput } from './shapePipelineShared.ts';
import {
  buildTransformByBandTasks,
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
import type { ephemeralShapeDB } from '@hierarchidb/shape-store';

export type ShapeTransformStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  bands: Array<{ bandId: number; zMin: number; zMax: number; zBase: number }>;
  enableHighDetailBands: boolean;
  countryLookup: Map<string, CountryMetadata>;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  ephemeralStore: typeof ephemeralShapeDB;
  diffBuildEnabled: boolean;
  recyclingAllowlist: Set<string>;
};

export const runShapeTransformStageSection = async (params: ShapeTransformStageParams): Promise<boolean> => {
  let existingTransformByBandTasks = params.resumeExistingTasks
    ? await listTasksByStage(params.taskQueue, params.nodeId, 'transform')
    : [];
  const transformConfigSignature = buildStableSignature(resolveTransformConfig(params.buildConfig));
  const desiredTransformTasks = await buildTransformByBandTasks(
    params.nodeId,
    params.bands,
    params.enableHighDetailBands,
    params.countryLookup,
    transformConfigSignature,
  );
  if (params.resumeExistingTasks && existingTransformByBandTasks.length > 0) {
    existingTransformByBandTasks = await filterObsoleteTasks(
      params.taskQueue,
      existingTransformByBandTasks,
      desiredTransformTasks,
    );
  }
  let missingTransformTasks: Array<TaskQueueRecord<ShapeTransformByBandTaskInput>> = [];
  if (params.resumeExistingTasks) {
    const existingIds = new Set(existingTransformByBandTasks.map((task) => task.taskId));
    missingTransformTasks = desiredTransformTasks.filter((task) => !existingIds.has(task.taskId)) as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
    if (missingTransformTasks.length > 0) {
      await putTasks(params.taskQueue, missingTransformTasks);
    }
  } else {
    missingTransformTasks = desiredTransformTasks as Array<TaskQueueRecord<ShapeTransformByBandTaskInput>>;
    if (missingTransformTasks.length > 0) {
      await putTasks(params.taskQueue, missingTransformTasks);
    }
  }
  if (existingTransformByBandTasks.length === 0 && missingTransformTasks.length === 0) {
    return false;
  }
  await params.waitIfPaused?.();
  await resetStageRunningTasks(params.taskQueue, params.nodeId, 'transform');
  const transformByBandAbortController = new AbortController();
  const transformByBandHandler = createTransformByBandHandler({
    ephemeralDB: params.ephemeralStore,
    transformConfig: resolveTransformConfig(params.buildConfig),
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
};
