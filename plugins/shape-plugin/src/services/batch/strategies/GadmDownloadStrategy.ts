import type {
  DownloadStageBuildContext,
  DownloadStagePostprocessContext,
  DownloadStagePostprocessResult,
  DownloadStageStrategy,
  DownloadTaskPayloadBuildContext,
} from './DownloadStageStrategy.js';
import type { DownloadTask, DownloadTaskInput } from '../../../common/types/index.js';
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
    const inputsByTaskId = new Map<string, DownloadTaskInput>();
    const tasks: DownloadTask[] = context.downloadTaskPayloads.map((metadata, index) => {
      const taskId = buildDownloadTaskId(String(context.nodeId), metadata);
      const input: DownloadTaskInput = {
        dataSource: 'gadm',
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        url: metadata.url,
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
        dataSource: input?.dataSource ?? 'gadm',
        sourceUrl: input?.url ?? task.url,
      };
    });
    return { outputs };
  }
}
