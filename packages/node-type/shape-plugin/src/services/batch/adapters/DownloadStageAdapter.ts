import type { NodeId } from '@hierarchidb/common-type';
import type { DownloadTask } from '../../types';
import type { ProgressInfo } from '../../../shared';

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
  ): Promise<DownloadStageAdapterResult>;
}

