import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo } from '../../../../../common/types/index.js';
import type { DownloadTask, DownloadTaskInput } from '../../../../../common/types/index.js';
import type { SessionTaskRegistry } from '../../../SessionTaskRegistry.js';
import type { DownloadStageAdapter } from '../../../adapters/DownloadStageAdapter.js';

import { buildDownloadProgressReporter, resolveRunnableDownloadTasks } from './resolveRunnableDownloadTasks.js';
import { runDownloadAdapter } from './runDownloadAdapter.js';

export async function runDownloadStageOrchestrator(params: {
  nodeId: NodeId;

  // execution
  adapter: DownloadStageAdapter;
  maxConcurrent: number | undefined;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;

  // task data
  tasks: DownloadTask[];
  // accept inputs produced by strategies (DownloadTaskInput) or payloads (DownloadTaskPayload)
  inputsByTaskId: Map<string, DownloadTaskInput | import('../../../../../common/types/index.js').DownloadTaskPayload>;

  // registry (only minimal methods required by orchestrator)
  taskRegistry: Pick<SessionTaskRegistry, 'assignDownloadTaskIndices' | 'registerTasks' | 'markDownloadTasksCompletedWhenBuffersExist'>;

  // UI
  progressCallback?: (progress: ProgressInfo) => void;
}): Promise<{ total: number; completed: number; failed: number; skipped: number; alreadyCompleted: boolean }> {
  const {
    nodeId,
    adapter,
    maxConcurrent,
    waitIfPaused,
    getSignal,
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
    taskRegistry: { resolveStageTasks: (stage, ts) => (taskRegistry as any).resolveStageTasks ? (taskRegistry as any).resolveStageTasks(stage, ts) : ({} as any) },
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
