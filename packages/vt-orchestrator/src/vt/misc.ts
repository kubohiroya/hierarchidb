import { runStageTasks } from '../compareTaskOrder.js';
import { createTransformByBandHandler } from '../transform/createTransformByBandHandler.js';
import type { PipelineRunConfig } from '../types/types.js';
import { createVtHandler } from './vtStage.js';

export async function runPipeline(
  buildConfig: PipelineRunConfig
): Promise<void> {
  await runTransformByBand(buildConfig);
  await runVt(buildConfig);
}

export async function runTransformByBand(
  buildConfig: PipelineRunConfig
): Promise<void> {
  const handler = buildConfig.transformByBandHandler
    ?? (buildConfig.transformByBandHandler
      ? (createTransformByBandHandler(buildConfig.transformByBandHandler))
      : undefined);
  if (!handler) {
    throw new Error('transformByBandHandler is required to run transform stage.');
  }
  await runStageTasks({
    //db: buildConfig.transformByBandHandler,
    nodeId: buildConfig.nodeId,
    stage: 'transform',
    handler,
  });
}

export async function runVt(
  buildConfig: PipelineRunConfig
): Promise<void> {
  const handler = buildConfig.vtHandler
    ?? (buildConfig.vtHandler
      ? (createVtHandler(buildConfig.vtHandler))
      : undefined);
  if (!handler) {
    throw new Error('vtHandler is required to run vt stage.');
  }
  await runStageTasks({
    //db: buildConfig.vtHandler,
    nodeId: buildConfig.nodeId,
    stage: 'vt',
    handler,
  });
}
