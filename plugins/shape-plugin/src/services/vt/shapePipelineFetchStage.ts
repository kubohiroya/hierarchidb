import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '~/common/types/index';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
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
  try {
    await runShapeFetchStage({
      nodeId: params.nodeId,
      dataSource: params.dataSource,
      selectedArrayByCountries: params.selectedArrayByCountries,
      downloadTaskPayloads: params.downloadTaskPayloads,
      buildConfig: params.buildConfig,
      taskQueue: params.taskQueue,
      waitIfPaused: params.waitIfPaused,
      resumeExistingTasks: params.resumeExistingTasks,
      abortController: fetchAbortController,
      failureHandling: params.failureHandling,
      onTasksEnqueued: params.onTasksEnqueued,
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
      'fetch',
      `aborted: ${reason}`,
      '[ShapeFetch][PipelineDiagnostics] fetch stage aborted',
      params.pipelineRunId,
    );
    throw error;
  }
  let stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
  console.warn('[ShapeTransform][PipelineDiagnostics] stage fetch completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: stageCounts,
  }));
  const finalizedPending = await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'fetch',
    'aborted: fetch stage completed with pending tasks',
    '[ShapeFetch][PipelineDiagnostics] fetch stage finalized pending tasks',
    params.pipelineRunId,
  );
  if (finalizedPending.authPending > 0) {
    throw new FetchStageAuthPendingError();
  }
  if (finalizedPending.queued > 0 || finalizedPending.running > 0) {
    stageCounts = await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch');
  }
  if (stageCounts.failed > 0 && stageCounts.completed === 0) {
    return true;
  }
  return shouldStopAfterStage(
    params.buildContinuationPolicy,
    stageCounts.failed,
  );
};
