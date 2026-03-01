import type { NodeId } from '@hierarchidb/core-types';
import type { BuildProcessConfig } from '~/services/build/types';
import type {
  CountryMetadata,
  DataSourceName,
  SourceTask,
  SourceTaskPayload,
  SelectedArrayByCountries,
} from '~/common/types/index';

export interface SourceStageOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SourceStageBuildContext {
  nodeId: NodeId;
  sourceTaskPayloads: SourceTaskPayload[];
  config: BuildProcessConfig;
  options: SourceStageOptions;
}

export interface SourceTaskBuildResult {
  tasks: SourceTask[];
  // strategies now produce DownloadTaskPayload directly (解決案A)
  inputsByTaskId: Map<string, SourceTaskPayload>;
}

export interface SourceStagePostprocessContext extends SourceStageBuildContext {
  sourceTasks: SourceTask[];
  sourceTaskInputsById: Map<string, SourceTaskPayload>;
}

export interface SourcePayloadBuildContext {
  selectedArrayByCountries: SelectedArrayByCountries | undefined;
  countryMetadata: CountryMetadata[];
}

export interface SourceTaskPayloadFactory {
  buildSourceTaskPayloads(context: SourcePayloadBuildContext): SourceTaskPayload[];
}

export interface SourceStageOutput {
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

export interface SourceStagePostprocessResult {
  outputs: SourceStageOutput[];
}

export interface SourceStageStrategy extends SourceTaskPayloadFactory {
  buildSourceTasks(context: SourceStageBuildContext): Promise<SourceTaskBuildResult>;
  buildPostprocessOutputs(context: SourceStagePostprocessContext): Promise<SourceStagePostprocessResult>;
}
