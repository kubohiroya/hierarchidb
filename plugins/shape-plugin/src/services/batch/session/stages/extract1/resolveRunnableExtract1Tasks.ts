import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo, Extract1Task } from '../../../../../common/types/index.js';
import type { SessionTaskRegistry } from '../../../SessionTaskRegistry.js';

export type ResolveRunnableResult = {
  runnableTasks: Extract1Task[];
  total: number;
  baseCompleted: number;
  baseFailed: number;
  baseDone: number;
};

export async function resolveRunnableExtract1Tasks(params: {
  nodeId: NodeId;
  taskRegistry: Pick<SessionTaskRegistry, 'resolveStageTasks'>;
  tasks: Extract1Task[];
}): Promise<ResolveRunnableResult> {
  const { nodeId, taskRegistry, tasks } = params;

  const { runnableTasks, completedCount, failedCount, total } = await taskRegistry.resolveStageTasks('extract1', tasks);
  const baseCompleted = Math.min(completedCount, total);
  const baseFailed = Math.min(failedCount, total - baseCompleted);
  const baseDone = Math.min(total, baseCompleted + baseFailed);

  if (baseDone > 0) {
    console.debug(`[Session ${String(nodeId)}] Skipping completed extract1 tasks`, {
      total,
      runnable: runnableTasks.length,
      completed: baseCompleted,
      failed: baseFailed,
    });
  }

  return { runnableTasks, total, baseCompleted, baseFailed, baseDone };
}

export function buildExtract1ProgressReporter(params: {
  total: number;
  baseCompleted: number;
  baseFailed: number;
  progressCallback?: (progress: ProgressInfo) => void;
}): (p: ProgressInfo) => void {
  const { total, baseCompleted, baseFailed, progressCallback } = params;

  return (p: ProgressInfo) => {
    const completed = Math.min(total, baseCompleted + p.completed);
    const failed = Math.min(total - completed, baseFailed + p.failed);
    const skipped = p.skipped ?? 0;
    const done = Math.min(total, completed + failed + skipped);
    const percentage = total > 0 ? (done / total) * 100 : 0;

    progressCallback?.({
      ...p,
      total,
      completed,
      failed,
      skipped,
      percentage,
      currentStage: 'extract1',
    });
  };
}

