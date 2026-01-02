import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTaskInput, DownloadTask, ProgressInfo } from '../../../../../common/types/index.js';
import type { DownloadStageAdapter } from '../../../adapters/DownloadStageAdapter.js';

export async function runDownloadAdapter(params: {
  nodeId: NodeId;
  adapter: DownloadStageAdapter;
  runnableTasks: DownloadTask[];
  inputsByTaskId: Map<string, DownloadTaskInput>;
  reportProgress: (p: ProgressInfo) => void;
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  maxConcurrent?: number;
}): Promise<{ processed: number; failed: number }> {
  const { nodeId, adapter, runnableTasks, inputsByTaskId, reportProgress, waitIfPaused, getSignal, maxConcurrent } = params;

  return await adapter.process(nodeId, runnableTasks, inputsByTaskId, reportProgress, {
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });
}

