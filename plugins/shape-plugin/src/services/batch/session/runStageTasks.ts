import type { ProgressInfo } from '../../../common/types/index.js';
import type { ProcessingStage } from '../../../common/types/index.js';
import { buildStageProgressReporter, computeBaseCounts, computePercentage } from './stageProgress.js';
import { getDefaultStageMessages } from './stageTaskMessages.js';

export type ResolveStageTasksResult<TTask> = {
  runnableTasks: TTask[];
  completedCount: number;
  failedCount: number;
  total: number;
};

export type RunStageTasksParams<TTask> = {
  stage: ProcessingStage;
  tasks: TTask[];
  resolveStageTasks: () => Promise<ResolveStageTasksResult<TTask>>;
  processRunnableTasks: (params: {
    runnableTasks: TTask[];
    reportProgress: (p: ProgressInfo) => void;
  }) => Promise<{ processed: number; failed: number }>;
  progressCallback?: (p: ProgressInfo) => void;
  taskQueuedMessage?: string;
  alreadyCompletedMessage?: string;
  completedMessage?: string;
  onNoTasks?: () => Promise<void> | void;
  onNoRunnableTasks?: (base: { total: number; completed: number; failed: number }) => Promise<void> | void;
};

/**
 * 共通のステージ実行フロー：
 * - resolveStageTasks の結果から base counts を計算
 * - runnableTasks が無ければ「既に完了」扱いでprogressを通知
 * - runnableTasks があれば reportProgress を生成して processRunnableTasks を実行
 * - 最終の完了progressを通知
 */
export async function runStageTasks<TTask>(params: RunStageTasksParams<TTask>): Promise<{
  base: { total: number; completed: number; failed: number };
  result?: { processed: number; failed: number };
}> {
  const {
    stage,
    tasks,
    resolveStageTasks,
    processRunnableTasks,
    progressCallback,
    taskQueuedMessage: providedQueued,
    alreadyCompletedMessage: providedAlready,
    completedMessage: providedCompleted,
    onNoTasks,
    onNoRunnableTasks,
  } = params;

  const defaults = getDefaultStageMessages(stage);
  const taskQueuedMessage = providedQueued ?? defaults.taskQueuedMessage;
  const alreadyCompletedMessage = providedAlready ?? defaults.alreadyCompletedMessage;
  const completedMessage = providedCompleted ?? defaults.completedMessage;

  if (tasks.length === 0) {
    await onNoTasks?.();
    progressCallback?.({
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 100,
      currentStage: stage,
      currentTask: taskQueuedMessage,
    });
    return { base: { total: 0, completed: 0, failed: 0 } };
  }

  const resolved = await resolveStageTasks();
  const baseCounts = computeBaseCounts({
    total: resolved.total,
    completedCount: resolved.completedCount,
    failedCount: resolved.failedCount,
  });

  const base = {
    total: baseCounts.total,
    completed: baseCounts.baseCompleted,
    failed: baseCounts.baseFailed,
  };

  // queued progress
  progressCallback?.({
    total: base.total,
    completed: base.completed,
    failed: base.failed,
    skipped: 0,
    percentage: computePercentage({ total: base.total, completed: base.completed, failed: base.failed }),
    currentStage: stage,
    currentTask: taskQueuedMessage,
  });

  if (resolved.runnableTasks.length === 0) {
    progressCallback?.({
      total: base.total,
      completed: base.completed,
      failed: base.failed,
      skipped: 0,
      percentage: computePercentage({ total: base.total, completed: base.completed, failed: base.failed }),
      currentStage: stage,
      currentTask: alreadyCompletedMessage,
    });
    await onNoRunnableTasks?.(base);
    return { base };
  }

  const reportProgress = buildStageProgressReporter({
    base: { total: base.total, baseCompleted: base.completed, baseFailed: base.failed },
    stage,
    progressCallback,
  });

  const result = await processRunnableTasks({ runnableTasks: resolved.runnableTasks, reportProgress });

  const completed = Math.min(base.total, base.completed + result.processed);
  const failed = Math.min(base.total - completed, base.failed + result.failed);

  progressCallback?.({
    total: base.total,
    completed,
    failed,
    skipped: 0,
    percentage: computePercentage({ total: base.total, completed, failed }),
    currentStage: stage,
    currentTask: completedMessage,
  });

  return { base, result };
}
