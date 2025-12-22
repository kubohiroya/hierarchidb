import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../types.js';
import type { DownloadTask, UrlMetadata } from '../../../common/types/index.js';

export interface DownloadStageOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DownloadStageBuildContext {
  sessionId: string;
  nodeId: NodeId;
  urlMetadata: UrlMetadata[];
  config: BatchProcessConfig;
  options: DownloadStageOptions;
}

export interface DownloadStagePostprocessContext extends DownloadStageBuildContext {
  downloadTasks: DownloadTask[];
}

export interface DownloadStageOutput {
  inputBufferId: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  dataSource?: string;
  sourceUrl?: string;
}

export interface DownloadStagePostprocessResult {
  outputs: DownloadStageOutput[];
}

export interface DownloadStageStrategy {
  buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]>;
  postprocessDownloadOutputs(context: DownloadStagePostprocessContext): Promise<DownloadStagePostprocessResult>;
}
