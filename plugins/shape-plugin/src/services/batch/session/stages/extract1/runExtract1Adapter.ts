import type { Extract1StageAdapter } from '../../../adapters/Extract1StageAdapter.js';
import type { Extract1Task, ProgressInfo } from '../../../../../common/types/index.js';

export async function runExtract1Adapter(params: {
  adapter: Extract1StageAdapter;
  runnableTasks: Extract1Task[];
  reportProgress: (p: ProgressInfo) => void;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
}): Promise<void> {
  const { adapter, runnableTasks, reportProgress, waitIfPaused, getSignal, maxConcurrent } = params;

  await adapter.process(runnableTasks, reportProgress, {
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });
}

