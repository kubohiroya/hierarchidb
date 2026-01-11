import type {
  FetchStageBuildContext,
  FetchStagePostprocessContext,
  FetchStagePostprocessResult,
  FetchStageStrategy,
  FetchPayloadBuildContext,
} from './FetchStageStrategy.ts';
import type { NodeId } from '@hierarchidb/common-types';
import type { CountryMetadata, FetchTask, FetchTaskPayload } from '../../../common/types/index.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';
import { buildFetchTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';
import { buildRawDataDataSourceCacheKey } from '../../utils/chunkStore.js';

export class OsmFetchStageStrategy implements FetchStageStrategy {
  buildFetchTaskPayloads(context: FetchPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'openstreetmap',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildFetchTasks(context: FetchStageBuildContext) {
    const countryCodes = new Set<string>();
    context.fetchTaskPayloads.forEach((metadata) => {
      countryCodes.add(metadata.countryCode);
    });
    const metadataMap = await this.buildCountryMetadata(context.nodeId, Array.from(countryCodes.values()));
    const inputsByTaskId = new Map<string, FetchTaskPayload>();
    const tasks: FetchTask[] = context.fetchTaskPayloads.map((metadata, index) => {
      const taskId = buildFetchTaskId(String(context.nodeId), metadata);
      const payload: FetchTaskPayload = {
        url: metadata.url,
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        dataSource: 'openstreetmap',
      };
      // NOTE: bbox/tags (OSM-specific) are intentionally not stored in payload.
      // They should be derived by the download adapter/worker from country metadata when needed.
      void metadataMap;
      void this.resolveAdminLevelTag;
      inputsByTaskId.set(taskId, payload);
      return {
        taskId,
        nodeId: context.nodeId,
        stage: 'wait',
        type: 'fetch',
        status: 'queued',
        index,
        progress: 0,
        url: metadata.url,
        countryCode: metadata.countryCode,
        adminLevel: metadata.adminLevel,
      };
    });
    return { tasks, inputsByTaskId };
  }

  async buildPostprocessOutputs(
    context: FetchStagePostprocessContext,
  ): Promise<FetchStagePostprocessResult> {
    const outputs = context.fetchTask.map((task) => {
      const input = context.fetchTaskInputsById.get(task.taskId);
      if (!input) {
        throw new Error(`[OsmDownloadStrategy] Missing input for task ${task.taskId}`);
      }
      const sourceUrl = input.url;
      const cacheKey = buildRawDataDataSourceCacheKey({
        dataSource: input.dataSource,
        countryCode: input.countryCode,
        adminLevel: input.adminLevel,
        url: sourceUrl,
      });
      return {
        inputBufferId: cacheKey,
        countryCode: input.countryCode,
        countryName: input.countryName,
        adminLevel: input.adminLevel,
        dataSource: input.dataSource,
        sourceUrl,
      };
    });
    return { outputs };
  }

  private resolveAdminLevelTag(adminLevel?: number): string {
    if (adminLevel === 0) return 'countries';
    if (adminLevel === 1) return 'states';
    return 'administrative';
  }

  private async buildCountryMetadata(nodeId: NodeId, codes: string[]): Promise<Map<string, CountryMetadata>> {
    const metadata = await metadataLoader.getCountriesMetadata('openstreetmap', codes, nodeId);
    return new Map(metadata.map((item) => [item.countryCode.toUpperCase(), item]));
  }
}
