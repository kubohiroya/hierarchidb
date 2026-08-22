import { runStageTasks } from '~/runStageTasks';
import type { PipelineRunConfig } from '~/types/types';

export async function runPipeline(buildConfig: PipelineRunConfig): Promise<void> {
  await runGeometryStage(buildConfig);
  await runVt(buildConfig);
}

export async function runGeometryStage(buildConfig: PipelineRunConfig): Promise<void> {
  const handler = buildConfig.geometryStageHandler;
  if (!handler) {
    throw new Error('geometryStageHandler is required to run geometry stage.');
  }
  await runStageTasks({
    nodeId: buildConfig.nodeId,
    stageId: 'geometry-stage',
    capability: 'geometry',
    handler,
  });
}

export async function runVt(buildConfig: PipelineRunConfig): Promise<void> {
  const handler = buildConfig.vtHandler;
  if (!handler) {
    throw new Error('vtHandler is required to run tileEmit stage.');
  }
  await runStageTasks({
    nodeId: buildConfig.nodeId,
    stageId: 'tile-emit-stage',
    capability: 'tile-emit',
    handler,
  });
}
