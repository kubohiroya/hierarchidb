import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo } from '../../../../common/types/index.js';
import { buildStageProgressReporter, computeBaseCounts, computePercentage } from './stageProgress.js';

export type RunDownloadTasksParams<TTask, TInput> = {
  nodeId: NodeId;
  tasks: TTask[];
  inputsByTaskId: Map<string, TInput>;

  resolveStageTasks: () => Promise<{
    runnableTasks: TTask[];
    completedCount: number;
    failedCount: number;
    total: number;
  }>;

  process: (params: {
    nodeId: NodeId;
    runnableTasks: TTask[];
    inputsByTaskId: Map<string, TInput>;
    reportProgress: (p: ProgressInfo) => void;
  }) => Promise<{ processed: number; failed: number }>;

  progressCallback?: (progress: ProgressInfo) => void;
};

/**
 * download専用：
 * - resolveStageTasks→base計算→（runnableなしなら）already completed progress
 * - runnableありなら reportProgress を作って adapter.process を実行
 * - 完了progress
 */
export async function runDownloadTasks<TTask, TInput>(params: RunDownloadTasksParams<TTask, TInput>): Promise<{
  total: number;
  completed: number;
  failed: number;
}> {
  const { nodeId, inputsByTaskId, resolveStageTasks, process, progressCallback } = params;

  const { runnableTasks, completedCount, failedCount, total } = await resolveStageTasks();
  const base = computeBaseCounts({ total, completedCount, failedCount });

  if (runnableTasks.length === 0) {
    progressCallback?.({
      total: base.total,
      completed: base.baseCompleted,
      failed: base.baseFailed,
      skipped: 0,
      percentage: computePercentage({ total: base.total, completed: base.baseCompleted, failed: base.baseFailed }),
      currentStage: 'download',
      currentTask: 'Download already completed',
    });

    return { total: base.total, completed: base.baseCompleted, failed: base.baseFailed };
  }

  const reportProgress = buildStageProgressReporter({
    base,
    stage: 'download',
    progressCallback,
  });

  const result = await process({ nodeId, runnableTasks, inputsByTaskId, reportProgress });

  const completed = Math.min(base.total, base.baseCompleted + result.processed);
  const failed = Math.min(base.total - completed, base.baseFailed + result.failed);

  progressCallback?.({
    total: base.total,
    completed,
    failed,
    skipped: 0,
    percentage: computePercentage({ total: base.total, completed, failed }),
    currentStage: 'download',
    currentTask: 'Download completed',
  });

  return { total: base.total, completed, failed };
}
