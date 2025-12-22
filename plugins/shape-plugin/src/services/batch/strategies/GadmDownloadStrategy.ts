import type { DownloadStageBuildContext, DownloadStagePostprocessContext, DownloadStagePostprocessResult, DownloadStageStrategy } from './DownloadStageStrategy.js';
import type { DownloadTask } from '../../../common/types/index.js';

export class GadmDownloadStrategy implements DownloadStageStrategy {
  async buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]> {
    return context.urlMetadata.map((metadata, index) => ({
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
        dataSource: 'gadm',
        country: metadata.countryCode ?? 'UNKNOWN',
        adminLevel: metadata.adminLevel,
        url: metadata.url,
        timeoutMs: context.options.timeoutMs ?? 0,
        retryDelay: context.options.retryDelay ?? 0,
        retryAttempts: context.options.retryAttempts ?? 0,
        expectedFormat: 'geojson',
        validateSSL: true,
      },
    }));
  }

  async postprocessDownloadOutputs(
    context: DownloadStagePostprocessContext,
  ): Promise<DownloadStagePostprocessResult> {
    const outputs = context.urlMetadata.map((metadata, index) => ({
      inputBufferId: `${context.sessionId}-download-${index}`,
      countryCode: metadata.countryCode,
      countryName: metadata.countryName,
      adminLevel: metadata.adminLevel,
      dataSource: metadata.dataSource ?? 'gadm',
      sourceUrl: metadata.url,
    }));
    return { outputs };
  }
}
