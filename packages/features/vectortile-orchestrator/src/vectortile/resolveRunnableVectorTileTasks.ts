import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo, VectorTileTask } from '../ports/sharedTypes.js';

export type ResolveRunnableResult<TTask> = {
  runnableTasks: TTask[];
  total: number;
  baseCompleted: number;
  baseFailed: number;
  baseDone: number;
};

export async function resolveRunnableVectorTileTasks<TTask = VectorTileTask>(params: {
  nodeId: NodeId;
  taskRegistry: {
    resolveStageTasks: (
      stage: 'vectortile',
      tasks: TTask[],
    ) => Promise<{ runnableTasks: TTask[]; completedCount: number; failedCount: number; total: number }>;
  };
  tasks: TTask[];
}): Promise<ResolveRunnableResult<TTask>> {
  const { nodeId, taskRegistry, tasks } = params;

  const { runnableTasks, completedCount, failedCount, total } = await taskRegistry.resolveStageTasks('vectortile', tasks);
  const baseCompleted = Math.min(completedCount, total);
  const baseFailed = Math.min(failedCount, total - baseCompleted);
  const baseDone = Math.min(total, baseCompleted + baseFailed);

  if (baseDone > 0) {
    console.debug(`[Session ${String(nodeId)}] Skipping completed vector tile tasks`, {
      total,
      runnable: runnableTasks.length,
      completed: baseCompleted,
      failed: baseFailed,
    });
  }

  return { runnableTasks, total, baseCompleted, baseFailed, baseDone };
}

export function buildVectorTileProgressReporter<TProgress extends ProgressInfo = ProgressInfo>(params: {
  total: number;
  baseCompleted: number;
  baseFailed: number;
  progressCallback?: (progress: TProgress) => void;
}): (p: TProgress) => void {
  const { total, baseCompleted, baseFailed, progressCallback } = params;

  return (p: TProgress) => {
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
      taskType: 'vectortile',
    });
  };
}
