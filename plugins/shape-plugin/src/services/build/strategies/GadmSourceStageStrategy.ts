import type {
  SourceStageBuildContext,
  SourceStagePostprocessContext,
  SourceStagePostprocessResult,
  SourceStageStrategy,
  SourcePayloadBuildContext,
} from './SourceStageStrategy.ts';
import type { SourceTask, SourceTaskPayload } from '~/common/types/index';
import { buildSourceTaskId, generateDownloadTaskPayloadsFromSelection } from '~/services/utils/utils';
import { buildRawDataDataSourceCacheKey } from '~/services/utils/chunkStore';

export class GadmSourceStageStrategy implements SourceStageStrategy {
  buildSourceTaskPayloads(context: SourcePayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      'gadm',
      context.selectedArrayByCountries,
      context.countryMetadata,
    );
  }

  async buildSourceTasks(context: SourceStageBuildContext) {
    const inputsByTaskId = new Map<string, SourceTaskPayload>();
    const tasks: SourceTask[] = context.sourceTaskPayloads.map((metadata, index) => {
      const taskId = buildSourceTaskId(String(context.nodeId), metadata);
      const payload: SourceTaskPayload = {
        url: metadata.url,
        countryCode: metadata.countryCode,
        countryName: metadata.countryName,
        adminLevel: metadata.adminLevel,
        dataSource: 'gadm',
      };
      inputsByTaskId.set(taskId, payload);
      return {
        taskId,
        type: 'source',
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
    context: SourceStagePostprocessContext,
  ): Promise<SourceStagePostprocessResult> {
    const outputs = context.sourceTasks.map((task) => {
      const input = context.sourceTaskInputsById.get(task.taskId);
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
