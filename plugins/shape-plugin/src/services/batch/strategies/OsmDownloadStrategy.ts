import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { CountryMetadata, DownloadTask } from '../../../common/types/index.js';
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

  async buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]> {
    const countryCodes = new Set<string>();
    context.downloadTaskPayloads.forEach((metadata) => {
      if (metadata.countryCode) {
        countryCodes.add(metadata.countryCode);
      }
    });
    const metadataMap = await this.buildCountryMetadata(Array.from(countryCodes.values()));
    return context.downloadTaskPayloads.map((metadata, index) => {
      const country = metadata.countryCode ? metadataMap.get(metadata.countryCode.toUpperCase()) : undefined;
      return ({
      taskId: buildDownloadTaskId(String(context.nodeId), metadata),
      sessionId: context.sessionId,
      taskType: 'download',
      stage: 'wait',
      type: 'download',
      status: 'waiting',
      index,
      progress: 0,
      url: metadata.url,
      config: {
        dataSource: 'openstreetmap',
        country: metadata.countryCode ?? 'UNKNOWN',
        adminLevel: metadata.adminLevel,
        url: metadata.url,
        bbox: country?.bbox,
        tags: [this.resolveAdminLevelTag(metadata.adminLevel)],
        timeoutMs: context.options.timeoutMs ?? 0,
        retryDelay: context.options.retryDelay ?? 0,
        retryAttempts: context.options.retryAttempts ?? 0,
        expectedFormat: 'geojson',
        validateSSL: true,
      },
      });
    });
  }

  async postprocessDownloadOutputs(
    context: DownloadStagePostprocessContext,
  ): Promise<DownloadStagePostprocessResult> {
    const payloadByUrl = new Map(context.downloadTaskPayloads.map((payload) => [payload.url, payload]));
    const outputs = context.downloadTasks.map((task) => {
      const payload = task.config?.url ? payloadByUrl.get(task.config.url) : undefined;
      return {
        inputBufferId: `${context.sessionId}-download-${task.index ?? 0}`,
        countryCode: payload?.countryCode ?? task.countryCode,
        countryName: payload?.countryName,
        adminLevel: payload?.adminLevel ?? task.config?.adminLevel,
        dataSource: payload?.dataSource ?? 'openstreetmap',
        sourceUrl: payload?.url ?? task.config?.url,
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
