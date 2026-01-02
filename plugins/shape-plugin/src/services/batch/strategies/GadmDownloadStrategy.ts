import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';
import { buildDownloadTaskId, generateDownloadTaskPayloadsFromSelection } from '../../utils/utils.js';

export class GadmDownloadStrategy implements DownloadStageStrategy {
  buildDownloadTaskPayloads(context: DownloadTaskPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'gadm',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildDownloadTasks(context: DownloadStageBuildContext) {
    const inputsByTaskId = new Map<string, DownloadTaskPayload>();
    const tasks: DownloadTask[] = context.downloadTaskPayloads.map((metadata, index) => {
      const taskId = buildDownloadTaskId(String(context.nodeId), metadata);
      const payload: DownloadTaskPayload = {
        url: metadata.url,
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        dataSource: 'gadm',
      };
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
      return {
        inputBufferId: `${context.nodeId}-download-${task.index ?? 0}`,
        countryCode: input?.countryCode ?? task.countryCode,
        countryName: input?.countryName,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        dataSource: input?.dataSource ?? 'gadm',
        sourceUrl: input?.url ?? task.url,
      };
    });
    return { outputs };
  }
}
