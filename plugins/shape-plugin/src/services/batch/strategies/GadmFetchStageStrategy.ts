import type {
  FetchStageBuildContext,
  FetchStagePostprocessContext,
  FetchStagePostprocessResult,
  FetchStageStrategy,
  FetchPayloadBuildContext,
} from './FetchStageStrategy.ts';
import type { FetchTask, FetchTaskPayload } from '~/common/types/index';
import { buildFetchTaskId, generateDownloadTaskPayloadsFromSelection } from '~/services/utils/utils';
import { buildRawDataDataSourceCacheKey } from '~/services/utils/chunkStore';

export class GadmFetchStageStrategy implements FetchStageStrategy {
  buildFetchTaskPayloads(context: FetchPayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'gadm',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildFetchTasks(context: FetchStageBuildContext) {
    const inputsByTaskId = new Map<string, FetchTaskPayload>();
    const tasks: FetchTask[] = context.fetchTaskPayloads.map((metadata, index) => {
      const taskId = buildFetchTaskId(String(context.nodeId), metadata);
      const payload: FetchTaskPayload = {
        url: metadata.url,
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        dataSource: 'gadm',
      };
      inputsByTaskId.set(taskId, payload);
      return {
        taskId,
        type: 'fetch',
        nodeId: context.nodeId,
        stage: 'wait',
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
        throw new Error(`[GadmDownloadStrategy] Missing input for task ${task.taskId}`);
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
}
