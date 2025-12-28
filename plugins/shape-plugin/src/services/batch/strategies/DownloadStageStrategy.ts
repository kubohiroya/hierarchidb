import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../types.js';
import type { CountryMetadata, DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';

export interface DownloadStageOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DownloadStageBuildContext {
  sessionId: string;
  nodeId: NodeId;
  downloadTaskPayloads: DownloadTaskPayload[];
  config: BatchProcessConfig;
  options: DownloadStageOptions;
}

export interface DownloadStagePostprocessContext extends DownloadStageBuildContext {
  downloadTasks: DownloadTask[];
}

export interface DownloadTaskPayloadBuildContext {
  selectedArrayByCountries: boolean[][] | undefined;
  countryMetadata: CountryMetadata[];
}

export interface DownloadTaskPayloadFactory {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext): DownloadTaskPayload[];
}

export interface DownloadStageOutput {
  inputBufferId: string;
  countryCode?: string;
  countryName?: string;
  adminLevel?: number;
  dataSource?: string;
  sourceUrl?: string;
  featureGroupId?: string;
  featureLabel?: string;
  featureIndex?: number;
  featureCount?: number;
}

export interface DownloadStagePostprocessResult {
  outputs: DownloadStageOutput[];
}

export interface DownloadStageStrategy extends DownloadTaskPayloadFactory {
  buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]>;
  postprocessDownloadOutputs(context: DownloadStagePostprocessContext): Promise<DownloadStagePostprocessResult>;
}
