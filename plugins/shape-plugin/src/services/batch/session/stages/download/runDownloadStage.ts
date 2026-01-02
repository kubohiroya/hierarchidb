import type { ProgressInfo } from '../../../../../common/types/index.js';
import type { DownloadStageContext } from './types.js';
import { resolveDownloadStageStrategy } from '../../../strategies/resolveDownloadStageStrategy.js';
import { runDownloadTasks } from '../../runDownloadTasks.js';
import type { DownloadStageAdapter } from '../../../adapters/DownloadStageAdapter.js';
import type { SessionTaskRegistry } from '../../../SessionTaskRegistry.js';
import type { DownloadStageStrategyOptions } from '../../../strategies/DownloadStageStrategy.js';

export async function runDownloadStage(params: {
  ctx: DownloadStageContext;
  adapter: DownloadStageAdapter;
  taskRegistry: SessionTaskRegistry;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
  progressCallback?: (progress: ProgressInfo) => void;
  strategyOptions: DownloadStageStrategyOptions;
}): Promise<{
  stageOutputs: Awaited<ReturnType<ReturnType<typeof resolveDownloadStageStrategy>['postprocessDownloadOutputs']>>;
}> {
  const { ctx, adapter, taskRegistry, waitIfPaused, getSignal, maxConcurrent, progressCallback, strategyOptions } = params;

  ctx.setCurrentStage('download');

  const dataSource = ctx.resolveDataSource();
  const strategy = resolveDownloadStageStrategy(dataSource);

  const { tasks, inputsByTaskId } = await strategy.buildDownloadTasks({
    nodeId: ctx.nodeId,
    downloadTaskPayloads: ctx.downloadTaskPayloads,
    config: ctx.config,
    options: strategyOptions,
  });

  const existingTaskIds = await taskRegistry.assignDownloadTaskIndices(tasks);
  await taskRegistry.registerTasks('download', tasks, existingTaskIds, inputsByTaskId);
  await taskRegistry.markDownloadTasksCompletedWhenBuffersExist(tasks);

  await runDownloadTasks({
    nodeId: ctx.nodeId,
    tasks,
    inputsByTaskId,
    resolveStageTasks: async () => taskRegistry.resolveStageTasks('download', tasks),
    process: async ({ nodeId, runnableTasks, inputsByTaskId, reportProgress }) => {
      const res = await adapter.process(nodeId, runnableTasks, inputsByTaskId, reportProgress, {
        waitIfPaused,
        getSignal,
        maxConcurrent,
      });
      return { processed: res.processed, failed: res.failed };
    },
    progressCallback,
  });

  const stageOutputs = await strategy.postprocessDownloadOutputs({
    nodeId: ctx.nodeId,
    downloadTaskPayloads: ctx.downloadTaskPayloads,
    config: ctx.config,
    options: strategyOptions,
    downloadTasks: tasks,
    downloadInputsById: inputsByTaskId,
  });

  return { stageOutputs };
}
