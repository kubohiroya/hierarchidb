import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../../../../batch/types.js';
import type { DownloadStagePostprocessResult, DownloadStageStrategy, DownloadStageOptions } from '../../../strategies/DownloadStageStrategy.js';
import type { DownloadTask, DownloadTaskPayload } from '../../../../../common/types/index.js';

export async function postprocessDownloadOutputs(params: {
  strategy: DownloadStageStrategy;
  nodeId: NodeId;
  downloadTaskPayloads: DownloadTaskPayload[];
  config: BatchProcessConfig;
  options: DownloadStageOptions;
  downloadTasks: DownloadTask[];
  downloadInputsById: Map<string, DownloadTaskPayload>;
}): Promise<DownloadStagePostprocessResult> {
  const {
    strategy,
    nodeId,
    downloadTaskPayloads,
    config,
    options,
    downloadTasks,
    downloadInputsById,
  } = params;

  return await strategy.postprocessDownloadOutputs({
    nodeId,
    downloadTaskPayloads,
    config,
    options,
    downloadTasks,
    downloadInputsById,
  });
}
