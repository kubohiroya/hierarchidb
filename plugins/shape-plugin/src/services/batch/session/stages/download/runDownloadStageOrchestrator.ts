import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo } from '../../../../../common/types/index.js';
import type { DownloadTask, DownloadTaskPayload } from '../../../../../common/types/index.js';
import type { SessionTaskRegistry } from '../../../SessionTaskRegistry.js';
import type { DownloadStageAdapter } from '../../../adapters/DownloadStageAdapter.js';

import { buildDownloadProgressReporter, resolveRunnableDownloadTasks } from './resolveRunnableDownloadTasks.js';
import { runDownloadAdapter } from './runDownloadAdapter.js';
import { defaultStageControls } from '../common/defaultStageControls.js';

export async function runDownloadStageOrchestrator(params: {
  nodeId: NodeId;

  // execution
  adapter: DownloadStageAdapter;
  maxConcurrent: number | undefined;
  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;

  // task data
  tasks: DownloadTask[];
  inputsByTaskId: Map<string, DownloadTaskPayload>;

  // registry (minimal methods used + resolveStageTasks for runnable filtering)
  taskRegistry: Pick<SessionTaskRegistry, 'assignDownloadTaskIndices' | 'registerTasks' | 'markDownloadTasksCompletedWhenBuffersExist' | 'resolveStageTasks'>;

  // UI
  progressCallback?: (progress: ProgressInfo) => void;
}): Promise<{ total: number; completed: number; failed: number; skipped: number; alreadyCompleted: boolean }> {
  const defaults = defaultStageControls();
  const {
    nodeId,
    adapter,
    maxConcurrent,
    waitIfPaused = defaults.waitIfPaused,
    getSignal = defaults.getSignal,
    tasks,
    inputsByTaskId,
    taskRegistry,
    progressCallback,
  } = params;

  const existingTaskIds = await taskRegistry.assignDownloadTaskIndices(tasks);
  await taskRegistry.registerTasks('download', tasks, existingTaskIds, inputsByTaskId);
  await taskRegistry.markDownloadTasksCompletedWhenBuffersExist(tasks);

  const { runnableTasks, baseCompleted, baseFailed, baseDone, total } = await resolveRunnableDownloadTasks({
    nodeId,
    taskRegistry: { resolveStageTasks: (stage, ts) => taskRegistry.resolveStageTasks(stage, ts) },
    tasks,
  });

  if (runnableTasks.length === 0) {
    progressCallback?.({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      currentStage: 'download',
      currentTask: 'Download already completed',
    });

    const alreadyCompleted = total > 0 && baseCompleted + baseFailed >= total;
    return {
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      alreadyCompleted,
    };
  }

  const reportProgress = buildDownloadProgressReporter({
    total,
    baseCompleted,
    baseFailed,
    progressCallback,
  });

  const res = await runDownloadAdapter({
    nodeId,
    adapter,
    runnableTasks,
    inputsByTaskId,
    reportProgress,
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });

  const processedTotal = baseCompleted + res.processed;
  const failedTotal = baseFailed + res.failed;
  const doneTotal = Math.min(total, processedTotal + failedTotal);
  const percentage = total > 0 ? (doneTotal / total) * 100 : 0;

  progressCallback?.({
    total,
    completed: processedTotal,
    failed: failedTotal,
    skipped: 0,
    percentage,
    currentStage: 'download',
    currentTask: 'Download completed',
  });

  return {
    total,
    completed: processedTotal,
    failed: failedTotal,
    skipped: 0,
    alreadyCompleted: false,
  };
}
