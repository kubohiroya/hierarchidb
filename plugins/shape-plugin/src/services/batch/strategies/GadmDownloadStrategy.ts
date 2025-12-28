import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { DownloadTask } from '../../../common/types/index.js';
import { buildDownloadTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';

export class GadmDownloadStrategy implements DownloadStageStrategy {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'gadm',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildDownloadTasks(context: DownloadStageBuildContext): Promise<DownloadTask[]> {
    return context.downloadTaskPayloads.map((metadata, index) => ({
      taskId: buildDownloadTaskId(context.sessionId, metadata),
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
    const payloadByUrl = new Map(context.downloadTaskPayloads.map((payload) => [payload.url, payload]));
    const outputs = context.downloadTasks.map((task) => {
      const payload = task.config?.url ? payloadByUrl.get(task.config.url) : undefined;
      return {
        inputBufferId: `${context.sessionId}-download-${task.index ?? 0}`,
        countryCode: payload?.countryCode ?? task.countryCode,
        countryName: payload?.countryName,
        adminLevel: payload?.adminLevel ?? task.config?.adminLevel,
        dataSource: payload?.dataSource ?? 'gadm',
        sourceUrl: payload?.url ?? task.config?.url,
      };
    });
    return { outputs };
  }
}
