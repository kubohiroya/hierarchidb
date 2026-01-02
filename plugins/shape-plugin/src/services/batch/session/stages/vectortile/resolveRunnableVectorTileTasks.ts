import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo, VectorTileTask } from '../../../../../common/types/index.js';

export type ResolveRunnableResult = {
  runnableTasks: VectorTileTask[];
  total: number;
  baseCompleted: number;
  baseFailed: number;
  baseDone: number;
};

export async function resolveRunnableVectorTileTasks(params: {
  nodeId: NodeId;
  // accept a registry object that exposes resolveStageTasks specialized for VectorTileTask
  taskRegistry: {
    resolveStageTasks: (stage: 'vectortile', tasks: VectorTileTask[]) => Promise<{ runnableTasks: VectorTileTask[]; completedCount: number; failedCount: number; total: number }>;
  };
  tasks: VectorTileTask[];
}): Promise<ResolveRunnableResult> {
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

export function buildVectorTileProgressReporter(params: {
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
      currentStage: 'vectortile',
    });
  };
}
