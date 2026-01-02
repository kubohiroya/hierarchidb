import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../types.js';
import type {
  CountryMetadata,
  DataSourceName,
  DownloadTask,
  DownloadTaskPayload,
  SelectedArrayByCountries,
} from '../../../common/types/index.js';

export interface DownloadStageOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface DownloadStageBuildContext {
  nodeId: NodeId;
  downloadTaskPayloads: DownloadTaskPayload[];
  config: BatchProcessConfig;
  options: DownloadStageOptions;
}

export interface DownloadTaskBuildResult {
  tasks: DownloadTask[];
  // strategies now produce DownloadTaskPayload directly (解決案A)
  inputsByTaskId: Map<string, DownloadTaskPayload>;
}

export interface DownloadStagePostprocessContext extends DownloadStageBuildContext {
  downloadTasks: DownloadTask[];
  downloadInputsById: Map<string, DownloadTaskPayload>;
}

export interface DownloadTaskPayloadBuildContext {
  selectedArrayByCountries: SelectedArrayByCountries | undefined;
  countryMetadata: CountryMetadata[];
}

export interface DownloadTaskPayloadFactory {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext): DownloadTaskPayload[];
}

export interface DownloadStageOutput {
  inputBufferId: string;
  countryCode?: string;
  countryName?: string;
  continent?: string;
  adminLevel?: number;
  dataSource?: DataSourceName;
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
  buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTaskBuildResult>;
  postprocessDownloadOutputs(context: DownloadStagePostprocessContext): Promise<DownloadStagePostprocessResult>;
}
