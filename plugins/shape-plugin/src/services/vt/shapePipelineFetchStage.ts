import type { BuildContinuationPolicy, NodeId } from '@hierarchidb/common-types';
import type { DataSourceName, FetchTaskPayload, SelectedArrayByCountries } from '../../common/types/index.js';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { runShapeFetchStage } from './shapeFetchStage.js';
import {
  finalizePendingStageTasks,
  getFailedTaskCount,
  shouldStopAfterStage,
  summarizeStageCounts,
} from './shapePipelineStageHelpers.ts';

export type ShapeFetchStageParams = {
  nodeId: NodeId;
  dataSource: DataSourceName;
  selectedArrayByCountries?: SelectedArrayByCountries;
  downloadTaskPayloads?: FetchTaskPayload[];
  buildConfig: ShapeBuildConfig;
  taskQueue: VtTaskQueueDb;
  waitIfPaused?: () => Promise<void>;
  resumeExistingTasks: boolean;
  failureHandling: 'continue' | 'stop';
  buildContinuationPolicy: BuildContinuationPolicy;
  pipelineRunId?: string;
};

export const runShapeFetchStageSection = async (params: ShapeFetchStageParams): Promise<boolean> => {
  const fetchAbortController = new AbortController();
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
  });
  console.warn('[ShapeTransform][PipelineDiagnostics] stage fetch completed', JSON.stringify({
    nodeId: params.nodeId,
    runId: params.pipelineRunId ?? null,
    counts: await summarizeStageCounts(params.taskQueue, params.nodeId, 'fetch'),
  }));
  await finalizePendingStageTasks(
    params.taskQueue,
    params.nodeId,
    'fetch',
    'aborted: fetch stage completed with pending tasks',
    '[ShapeFetch][PipelineDiagnostics] fetch stage finalized pending tasks',
    params.pipelineRunId,
  );
  return shouldStopAfterStage(
    params.buildContinuationPolicy,
    await getFailedTaskCount(params.taskQueue, params.nodeId, 'fetch'),
  );
};
