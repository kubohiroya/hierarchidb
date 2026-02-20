import type { ProgressInfo, VectorTileTask } from '~/ports/sharedTypes';
import type { VectorTileStageAdapter } from '~/ports/VectorTileStageAdapter';

export async function runVectorTileAdapter<TTask = VectorTileTask, TProgress extends ProgressInfo = ProgressInfo>(params: {
  adapter: VectorTileStageAdapter<TTask, TProgress>;
  runnableTasks: TTask[];
  reportProgress: (p: TProgress) => void;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
  requestPause?: (message: string) => void | Promise<void>;
}): Promise<{ processed: number; failed: number }> {
  const { adapter, runnableTasks, reportProgress, waitIfPaused, getSignal, maxConcurrent, requestPause } = params;

  return await adapter.process(runnableTasks, reportProgress, {
    waitIfPaused,
    getSignal,
    maxConcurrent,
    requestPause,
  });
}
