import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName, SourceTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { listTasksByStage } from '@hierarchidb/vt-orchestrator';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { runShapeSourceStage } from './runShapeSourceStage.js';
import {
  finalizePendingStageTasks,
  markStageTasksRecycled,
  resetStageRunningTasks,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';

export type ShapeSourceStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: SourceTaskPayload[];
  buildConfig: ShapeRuntimeBuildConfig;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
  abortSignal?: AbortSignal;
  onTasksEnqueued?: (payload: {
    nodeId: NodeId;
    stage: 'source';
    taskCount: number;
    source: 'created' | 'reused';
  }) => Promise<void> | void;
};

export class SourceStageAuthPendingError extends Error {
  constructor(message = 'source stage paused: authentication required') {
    super(message);
    this.name = 'SourceStageAuthPendingError';
  }
}

export const runShapeSourceStageSection = async (params: ShapeSourceStageParams): Promise<boolean> => {
  const sourceAbortController = new AbortController();
  await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
  if (params.resumeExistingTasks) {
    await markStageTasksRecycled(params.taskQueue, params.nodeId, 'source');
  }
  const runSourcePass = async (resumeExistingTasks: boolean): Promise<void> => {
    await runShapeSourceStage({
      nodeId: params.nodeId,
      dataSource: params.dataSource,
      selectedArrayByCountries: params.selectedArrayByCountries,
      downloadTaskPayloads: params.downloadTaskPayloads,
      buildConfig: params.buildConfig,
      taskQueue: params.taskQueue,
      waitIfPaused: params.waitIfPaused,
      resumeExistingTasks,
      abortController: sourceAbortController,
      failureHandling: params.failureHandling,
      onTasksEnqueued: params.onTasksEnqueued,
    });
  };
  try {
    await runSourcePass(params.resumeExistingTasks);
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const failedTaskId = error && typeof error === 'object'
      ? (error as { taskId?: string }).taskId
      : undefined;
    const reason = failedTaskId ? `${baseMessage} (failedTaskId=${failedTaskId})` : baseMessage;
    await finalizePendingStageTasks(
      params.taskQueue,
      params.nodeId,
      'source',
      `aborted: ${reason}`,
      '[ShapeSource][PipelineDiagnostics] source stage aborted',
      params.pipelineRunId,
    );
    throw error;
  }
  let stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
  console.warn('[ShapeSource][PipelineDiagnostics] stage source completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: stageCounts,
  }));
  if (!params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    console.warn('[ShapeSource][PipelineDiagnostics] source stage left pending tasks on fresh run; retrying queued drain once', JSON.stringify({
      nodeId: params.nodeId,
      runId: params.pipelineRunId ?? null,
      counts: stageCounts,
    }));
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
    await runSourcePass(true);
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
  }
  if (params.resumeExistingTasks && (stageCounts.queued > 0 || stageCounts.running > 0)) {
    await resetStageRunningTasks(params.taskQueue, params.nodeId, 'source');
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
    if (stageCounts.queued > 0 || stageCounts.running > 0) {
      console.warn('[ShapeSource][PipelineDiagnostics] source stage left pending tasks during resume; keep queued for next retry', JSON.stringify({
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
    'source',
    'aborted: source stage completed with pending tasks',
    '[ShapeSource][PipelineDiagnostics] source stage finalized pending tasks',
    params.pipelineRunId,
    {
      markFailed: shouldFinalizePending,
    },
  );
  if (finalizedPending.authPending > 0) {
    throw new SourceStageAuthPendingError();
  }
  if (finalizedPending.queued > 0 || finalizedPending.running > 0) {
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'source');
  }
  const fetchTasks = await listTasksByStage(params.taskQueue, params.nodeId, 'source');
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
    sourceStageMaxima: {
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
