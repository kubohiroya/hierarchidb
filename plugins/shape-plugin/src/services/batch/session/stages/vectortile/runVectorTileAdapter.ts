import type { VectorTileStageAdapter } from '../../../adapters/VectorTileStageAdapter.js';
import type { ProgressInfo, VectorTileTask, ProcessingStage } from '../../../../../common/types/index.js';

export async function runVectorTileAdapter(params: {
  adapter: VectorTileStageAdapter;
  runnableTasks: VectorTileTask[];
  reportProgress: (p: ProgressInfo) => void;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
  requestPause?: (message: string) => void | Promise<void>;
  stageForPause?: ProcessingStage; // kept for parity; currently unused
}): Promise<{ processed: number; failed: number }> {
  const { adapter, runnableTasks, reportProgress, waitIfPaused, getSignal, maxConcurrent, requestPause } = params;

  return await adapter.process(runnableTasks, reportProgress, {
    waitIfPaused,
    getSignal,
    maxConcurrent,
    requestPause,
  });
}

