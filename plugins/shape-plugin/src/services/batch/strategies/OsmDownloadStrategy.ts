import type { DownloadStageBuildContext, DownloadStagePostprocessContext, DownloadStagePostprocessResult, DownloadStageStrategy } from './DownloadStageStrategy.js';
import type { CountryMetadata, DownloadTask } from '../../../common/types/index.js';
import { metadataLoader } from '../../metadata/MetadataLoader.js';

export class OsmDownloadStrategy implements DownloadStageStrategy {
  async buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]> {
    const countryCodes = new Set<string>();
    context.urlMetadata.forEach((metadata) => {
      if (metadata.countryCode) {
        countryCodes.add(metadata.countryCode);
      }
    });
    const metadataMap = await this.buildCountryMetadata(Array.from(countryCodes.values()));
    return context.urlMetadata.map((metadata, index) => {
      const country = metadata.countryCode ? metadataMap.get(metadata.countryCode.toUpperCase()) : undefined;
      return ({
      taskId: `${context.sessionId}-download-${index}`,
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
    const outputs = context.urlMetadata.map((metadata, index) => ({
      inputBufferId: `${context.sessionId}-download-${index}`,
      countryCode: metadata.countryCode,
      countryName: metadata.countryName,
      adminLevel: metadata.adminLevel,
      dataSource: metadata.dataSource ?? 'openstreetmap',
      sourceUrl: metadata.url,
    }));
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
