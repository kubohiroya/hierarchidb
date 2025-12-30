import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { CountryMetadata, DownloadTask, DownloadTaskInput } from '../../../common/types/index.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';
import { buildDownloadTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';

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
    const metadataMap = await this.buildCountryMetadata(Array.from(countryCodes.values()));
    const inputsByTaskId = new Map<string, DownloadTaskInput>();
    const tasks: DownloadTask[] = context.downloadTaskPayloads.map((metadata, index) => {
      const country = metadata.countryCode ? metadataMap.get(metadata.countryCode.toUpperCase()) : undefined;
      const taskId = buildDownloadTaskId(String(context.nodeId), metadata);
      const input: DownloadTaskInput = {
        dataSource: 'openstreetmap',
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        url: metadata.url,
        bbox: country?.bbox,
        tags: [this.resolveAdminLevelTag(metadata.adminLevel)],
        timeoutMs: context.options.timeoutMs ?? 0,
        retryDelay: context.options.retryDelay ?? 0,
        retryAttempts: context.options.retryAttempts ?? 0,
      };
      inputsByTaskId.set(taskId, input);
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
      return {
        inputBufferId: `${context.nodeId}-download-${task.index ?? 0}`,
        countryCode: input?.countryCode ?? task.countryCode,
        countryName: input?.countryName,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        dataSource: input?.dataSource ?? 'openstreetmap',
        sourceUrl: input?.url ?? task.url,
      };
    });
    return { outputs };
  }

  private resolveAdminLevelTag(adminLevel?: number): string {
    if (adminLevel === 0) return 'countries';
    if (adminLevel === 1) return 'states';
    return 'administrative';
  }

  private async buildCountryMetadata(codes: string[]): Promise<Map<string, CountryMetadata>> {
    const metadata = await metadataLoader.getCountriesMetadata('openstreetmap', codes);
    return new Map(metadata.map((item) => [item.countryCode.toUpperCase(), item]));
  }
}
