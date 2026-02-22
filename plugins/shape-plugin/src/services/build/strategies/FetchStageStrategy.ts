import type { NodeId } from '@hierarchidb/core-types';
import type { BuildProcessConfig } from '~/services/build/types';
import type {
  CountryMetadata,
  DataSourceName,
  FetchTask,
  FetchTaskPayload,
  SelectedArrayByCountries,
} from '~/common/types/index';

export interface FetchStageOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface FetchStageBuildContext {
  nodeId: NodeId;
  fetchTaskPayloads: FetchTaskPayload[];
  config: BuildProcessConfig;
  options: FetchStageOptions;
}

export interface FetchTaskBuildResult {
  tasks: FetchTask[];
  // strategies now produce DownloadTaskPayload directly (解決案A)
  inputsByTaskId: Map<string, FetchTaskPayload>;
}

export interface FetchStagePostprocessContext extends FetchStageBuildContext {
  fetchTask: FetchTask[];
  fetchTaskInputsById: Map<string, FetchTaskPayload>;
}

export interface FetchPayloadBuildContext {
  selectedArrayByCountries: SelectedArrayByCountries | undefined;
  countryMetadata: CountryMetadata[];
}

export interface FetchTaskPayloadFactory {
  buildFetchTaskPayloads(context: FetchPayloadBuildContext): FetchTaskPayload[];
}

export interface FetchStageOutput {
  inputBufferId: string;
  countryCode?: string;
  countryName?: string;
  continent?: string;
  adminLevel?: number;
  dataSource: DataSourceName;
  sourceUrl?: string;
  featureGroupId?: string;
  featureLabel?: string;
  featureIndex?: number;
  featureCount?: number;
}

export interface FetchStagePostprocessResult {
  outputs: FetchStageOutput[];
}

export interface FetchStageStrategy extends FetchTaskPayloadFactory {
  buildFetchTasks(context: FetchStageBuildContext): Promise<FetchTaskBuildResult>;
  buildPostprocessOutputs(context: FetchStagePostprocessContext): Promise<FetchStagePostprocessResult>;
}
