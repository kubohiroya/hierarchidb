import type {
  SourceStageBuildContext,
  SourceStagePostprocessContext,
  SourceStagePostprocessResult,
  SourceStageStrategy,
  SourcePayloadBuildContext,
} from './SourceStageStrategy.ts';
import type { DataSourceName, SourceTask, SourceTaskPayload } from '~/common/types/index';
import { buildSourceTaskId, generateDownloadTaskPayloadsFromSelection } from '~/services/utils/shapeBuildUtils';
import { buildRawDataDataSourceCacheKey } from '~/services/utils/createShapeChunkStore';

export class GeoBoundariesSourceStageStrategy implements SourceStageStrategy {
  private readonly dataSource: DataSourceName;

  constructor(dataSource: DataSourceName = 'geoboundaries') {
    this.dataSource = dataSource;
  }

  buildSourceTaskPayloads(context: SourcePayloadBuildContext) {
    return generateDownloadTaskPayloadsFromSelection(
      this.dataSource,
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
        dataSource: this.dataSource,
      };
      inputsByTaskId.set(taskId, payload);
      return {
        taskId,
        nodeId: context.nodeId,
        stage: 'wait',
        type: 'source',
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
        throw new Error(`[GeoBoundariesDownloadStrategy] Missing input for task ${task.taskId}`);
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
