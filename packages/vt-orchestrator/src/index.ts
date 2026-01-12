import type { BuildConfig } from './types.js';
import { runStageTasks, type StageHandler } from './runner.js';
import { createTransformByBandHandler } from './transform/transformStage.js';
import { createTransformByZoomHandler } from './transform/transformByZoomStage.js';
import { createVtHandler } from './vt/vtStage.js';
export type {
  BandConfig,
  BuildConfig,
  TaskRecord,
  TransformByBandStageConfig,
  TransformByBandStageContext,
  TransformByBandTaskInput,
  TransformByZoomStageConfig,
  TransformByZoomStageContext,
  TransformByZoomTaskInput,
  VtStageConfig,
  VtStageContext,
  VtTaskInput,
} from './types.js';
export {
  VtTaskQueueDb,
  deleteTasksByNode,
  listTasks,
  listTasksByStage,
  listTasksByStageAndStatus,
  listTasksByStatus,
  onTaskQueueUpdate,
  putTasks,
  updateTask,
  type TaskQueueEvent,
  type TaskQueueRecord,
  type TaskStage,
  type TaskStatus,
} from './task/taskQueue.js';
export {
  runStageTasks,
  type RunStageOptions,
  type StageHandler,
  type StageHandlerResult,
} from './runner.js';
export { createTransformByBandHandler } from './transform/transformStage.js';
export { createTransformByZoomHandler } from './transform/transformByZoomStage.js';
export { createVtHandler } from './vt/vtStage.js';

export async function runPipeline(
  buildConfig: BuildConfig
): Promise<void> {
  await runTransformByBand(buildConfig);
  await runTransformByZoom(buildConfig);
  await runVt(buildConfig);
}

export async function runTransformByBand(
  buildConfig: BuildConfig
): Promise<void> {
  const handler = buildConfig.transformByBandHandler
    ?? (buildConfig.transformByBandContext
      ? (createTransformByBandHandler(buildConfig.transformByBandContext) as unknown as StageHandler)
      : undefined);
  if (!handler) {
    throw new Error('transformByBandHandler is required to run transform-by-band stage.');
  }
  await runStageTasks({
    db: buildConfig.taskQueue,
    nodeId: buildConfig.nodeId,
    stage: 'transform-by-band',
    handler,
  });
}

export async function runTransformByZoom(
  buildConfig: BuildConfig
): Promise<void> {
  const handler = buildConfig.transformByZoomHandler
    ?? (buildConfig.transformByZoomContext
      ? (createTransformByZoomHandler(buildConfig.transformByZoomContext) as unknown as StageHandler)
      : undefined);
  if (!handler) {
    throw new Error('transformByZoomHandler is required to run transform-by-zoom stage.');
  }
  await runStageTasks({
    db: buildConfig.taskQueue,
    nodeId: buildConfig.nodeId,
    stage: 'transform-by-zoom',
    handler,
  });
}

export async function runVt(
  buildConfig: BuildConfig
): Promise<void> {
  const handler = buildConfig.vtHandler
    ?? (buildConfig.vtContext
      ? (createVtHandler(buildConfig.vtContext) as unknown as StageHandler)
      : undefined);
  if (!handler) {
    throw new Error('vtHandler is required to run vt stage.');
  }
  await runStageTasks({
    db: buildConfig.taskQueue,
    nodeId: buildConfig.nodeId,
    stage: 'vt',
    handler,
  });
}
