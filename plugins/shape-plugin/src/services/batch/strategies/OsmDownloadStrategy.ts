import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { CountryMetadata, DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';
import { buildDownloadTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';
import { buildDownloadCacheKey } from '../../utils/chunkStore.js';

export class OsmDownloadStrategy implements DownloadStageStrategy {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'openstreetmap',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildDownloadTasks(context: DownloadStageBuildContext) {
    const countryCodes = new Set<string>();
    context.downloadTaskPayloads.forEach((metadata) => {
      if (metadata.countryCode) {
        countryCodes.add(metadata.countryCode);
      }
    });
    const metadataMap = await this.buildCountryMetadata(context.nodeId, Array.from(countryCodes.values()));
    const inputsByTaskId = new Map<string, DownloadTaskPayload>();
    const tasks: DownloadTask[] = context.downloadTaskPayloads.map((metadata, index) => {
      const taskId = buildDownloadTaskId(String(context.nodeId), metadata);
      const payload: DownloadTaskPayload = {
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
        taskType: 'download',
        stage: 'wait',
        type: 'download',
        status: 'waiting',
        index,
        progress: 0,
        url: metadata.url,
        countryCode: metadata.countryCode,
        adminLevel: metadata.adminLevel,
      };
    });
    return { tasks, inputsByTaskId };
  }

  async postprocessDownloadOutputs(
    context: DownloadStagePostprocessContext,
  ): Promise<DownloadStagePostprocessResult> {
    const outputs = context.downloadTasks.map((task) => {
      const input = context.downloadInputsById.get(task.taskId);
      const sourceUrl = input?.url ?? task.url;
      const cacheKey = buildDownloadCacheKey({
        dataSource: input?.dataSource ?? 'openstreetmap',
        countryCode: input?.countryCode ?? task.countryCode,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        url: sourceUrl,
      });
      return {
        inputBufferId: cacheKey,
        countryCode: input?.countryCode ?? task.countryCode,
        countryName: input?.countryName,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        dataSource: input?.dataSource ?? 'openstreetmap',
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
