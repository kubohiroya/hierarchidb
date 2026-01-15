import { runStageTasks } from '../compareTaskOrder.js';
import { createTransformByBandHandler } from '../transform/createTransformByBandHandler.js';
import { createTransformByZoomHandler } from '../transform/createTransformByZoomHandler.js';
import type { PipelineRunConfig } from '../types/types.js';
import { createVtHandler } from './vtStage.js';

export async function runPipeline(
  buildConfig: PipelineRunConfig
): Promise<void> {
  await runTransformByBand(buildConfig);
  await runTransformByZoom(buildConfig);
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
    throw new Error('transformByBandHandler is required to run transform-by-band stage.');
  }
  await runStageTasks({
    //db: buildConfig.transformByBandHandler,
    nodeId: buildConfig.nodeId,
    stage: 'transform-by-band',
    handler,
  });
}

export async function runTransformByZoom(
  buildConfig: PipelineRunConfig
): Promise<void> {
  const handler = buildConfig.transformByZoomHandler
    ?? (buildConfig.transformByZoomHandler
      ? (createTransformByZoomHandler(buildConfig.transformByZoomHandler))
      : undefined);
  if (!handler) {
    throw new Error('transformByZoomHandler is required to run transform-by-zoom stage.');
  }
  await runStageTasks({
    //db: buildConfig.transformByZoomHandler,
    nodeId: buildConfig.nodeId,
    stage: 'transform-by-zoom',
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
