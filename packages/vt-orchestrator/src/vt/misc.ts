import { runStageTasks } from '~/compareTaskOrder';
import type { PipelineRunConfig } from '~/types/types';

export async function runPipeline(
  buildConfig: PipelineRunConfig
): Promise<void> {
  await runTransformByBand(buildConfig);
  await runVt(buildConfig);
}

export async function runTransformByBand(
  buildConfig: PipelineRunConfig
): Promise<void> {
  const handler = buildConfig.transformByBandHandler;
  if (!handler) {
    throw new Error('transformByBandHandler is required to run transform stage.');
  }
  await runStageTasks({
    nodeId: buildConfig.nodeId,
    stageId: 'geometry-stage',
    capability: 'geometry',
    handler,
  });
}

export async function runVt(
  buildConfig: PipelineRunConfig
): Promise<void> {
  const handler = buildConfig.vtHandler;
  if (!handler) {
    throw new Error('vtHandler is required to run vt stage.');
  }
  await runStageTasks({
    nodeId: buildConfig.nodeId,
    stageId: 'tile-emit-stage',
    capability: 'tile-emit',
    handler,
  });
}
