import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTask } from '../../types.js';
import type { ProgressInfo } from '../../../shared/index.js';
import type { StageControls } from './StageControls.js';

export interface DownloadStageAdapterResult {
  processed: number;
  failed: number;
  totalFeatures?: number;
  totalDownloadSize?: number;
}

export interface DownloadStageAdapter {
  process(
    sessionId: string,
    nodeId: NodeId,
    tasks: DownloadTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult>;
}
