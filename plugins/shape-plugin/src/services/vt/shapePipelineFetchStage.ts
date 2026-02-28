import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { listTasksByStage } from '@hierarchidb/vt-orchestrator';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { runShapeFetchStage } from './shapeFetchStage.js';
import {
  finalizePendingStageTasks,
  markStageTasksRecycled,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';

export type ShapeFetchStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  buildConfig: ShapeRuntimeBuildConfig;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'fetch';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
};

export class FetchStageAuthPendingError extends Error {
  constructor(message = 'fetch stage paused: authentication required') {
    super(message);
    this.name = 'FetchStageAuthPendingError';
  }
}

export const runShapeFetchStageSection = async (params: ShapeFetchStageParams): Promise<boolean> => {
  const fetchAbortController = new AbortController();
  await resetStageRunningTasks(params.taskQueue, params.nodeId, 'fetch');
  if (params.resumeExistingTasks) {
    await markStageTasksRecycled(params.taskQueue, params.nodeId, 'fetch');
  }
  const runFetchPass = async (resumeExistingTasks: boolean): Promise<void> => {
    await runShapeFetchStage({
      nodeId: params.nodeId,
      dataSource: params.dataSource,
      selectedArrayByCountries: params.selectedArrayByCountries,
      downloadTaskPayloads: params.downloadTaskPayloads,
      buildConfig: params.buildConfig,
      taskQueue: params.taskQueue,
      waitIfPaused: params.waitIfPaused,
      resumeExistingTasks,
      abortController: fetchAbortController,
      failureHandling: params.failureHandling,
      onTasksEnqueued: params.onTasksEnqueued,
    });
  };
  try {
    await runFetchPass(params.resumeExistingTasks);
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const failedTaskId = error && typeof error === 'object'
      ? (error as { taskId?: string }).taskId
      : undefined;
    const reason = failedTaskId ? `${baseMessage} (failedTaskId=${failedTaskId})` : baseMessage;
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'fetch',
      `aborted: ${reason}`,
      '[ShapeFetch][PipelineDiagnostics] fetch stage aborted',
      params.pipelineRunId,
    );
    throw error;
  }
  let stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
  console.warn('[ShapeFetch][PipelineDiagnostics] stage fetch completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: stageCounts,
  }));
  if (!params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    console.warn('[ShapeFetch][PipelineDiagnostics] fetch stage left pending tasks on fresh run; retrying queued drain once', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      counts: stageCounts,
    }));
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'fetch');
    await runFetchPass(true);
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
  }
  if (params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'fetch');
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
    if (stageCounts.queued > 0 || stageCounts.running > 0) {
      console.warn('[ShapeFetch][PipelineDiagnostics] fetch stage left pending tasks during resume; keep queued for next retry', JSON.stringify({
        nodeId: params.nodeId,
        runId: params.pipelineRunId ?? null,
        counts: stageCounts,
      }));
    }
  }
  const shouldFinalizePending = !params.resumeExistingTasks || (stageCounts.queued === 0 && stageCounts.running === 0);
  const finalizedPending = await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'fetch',
    'aborted: fetch stage completed with pending tasks',
    '[ShapeFetch][PipelineDiagnostics] fetch stage finalized pending tasks',
    params.pipelineRunId,
    {
      markFailed: shouldFinalizePending,
    },
  );
  if (finalizedPending.authPending > 0) {
    throw new FetchStageAuthPendingError();
  }
  if (finalizedPending.queued > 0 || finalizedPending.running > 0) {
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
  }
  const fetchTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'fetch');
  let featureMax = 0;
  let polygonMax = 0;
  fetchTasks.forEach((task) => {
    const metadata = task.metadata;
    const fetchDetail = (typeof metadata === 'object' && metadata !== null
      ? (metadata as { fetchDetail?: unknown }).fetchDetail
      : null) as Record<string, unknown> | null;
    const features = fetchDetail && typeof fetchDetail.features === 'object' && fetchDetail.features !== null
      ? fetchDetail.features as Record<string, unknown>
      : null;
    const polygons = fetchDetail && typeof fetchDetail.polygonsPerFeature === 'object' && fetchDetail.polygonsPerFeature !== null
      ? fetchDetail.polygonsPerFeature as Record<string, unknown>
      : (fetchDetail && typeof fetchDetail.polygons === 'object' && fetchDetail.polygons !== null
        ? fetchDetail.polygons as Record<string, unknown>
        : null);
    const fallbackPolygons = fetchDetail && typeof fetchDetail.polygons === 'object' && fetchDetail.polygons !== null
      ? fetchDetail.polygons as Record<string, unknown>
      : null;
    const featureInput = typeof features?.input === 'number'
      ? features.input
      : (typeof features?.output === 'number' ? features.output : null);
    const polygonInput = typeof polygons?.input === 'number'
      ? polygons.input
      : (typeof polygons?.output === 'number' ? polygons.output : null);
    const polygonFromAverage = (
      polygonInput === null
      && typeof fallbackPolygons?.input === 'number'
      && featureInput !== null
      && featureInput > 0
    )
      ? (fallbackPolygons.input / featureInput)
      : null;
    const featureValue = featureInput;
    const polygonValue = polygonInput ?? polygonFromAverage;
    if (featureValue !== null && Number.isFinite(featureValue) && featureValue > featureMax) {
      featureMax = Math.max(0, Math.round(featureValue));
    }
    if (polygonValue !== null && Number.isFinite(polygonValue) && polygonValue > polygonMax) {
      polygonMax = Math.max(0, Math.round(polygonValue));
    }
  });
  await shapeMutationAPIImpl.updateBuildSession(params.nodeId, {
    fetchStageMaxima: {
      featureMax,
      polygonMax,
    },
  });
  if (stageCounts.failed > 0 && stageCounts.completed === 0) {
    return true;
  }
  return shouldStopAfterStage(
    params.buildContinuationPolicy,
    stageCounts.failed,
  );
};
