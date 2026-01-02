import type { Extract2StageAdapter } from '../../../adapters/Extract2StageAdapter.js';
import type { Extract2Task, ProgressInfo } from '../../../../../common/types/index.js';

export async function runExtract2Adapter(params: {
  adapter: Extract2StageAdapter;
  runnableTasks: Extract2Task[];
  reportProgress: (p: ProgressInfo) => void;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
}): Promise<{ processed: number; failed: number }> {
  const { adapter, runnableTasks, reportProgress, waitIfPaused, getSignal, maxConcurrent } = params;

  return await adapter.process(runnableTasks, reportProgress, {
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });
}

