import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';
import type { ProgressInfo } from '../../../common/types/index.js';
import type { StageControls } from './StageControls.js';

export interface DownloadStageAdapterResult {
  processed: number;
  failed: number;
  totalFeatures?: number;
  totalDownloadSize?: number;
}

export interface DownloadStageAdapter {
  process(
    nodeId: NodeId,
    tasks: DownloadTask[],
    inputsByTaskId: Map<string, DownloadTaskPayload>,
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult>;
}
