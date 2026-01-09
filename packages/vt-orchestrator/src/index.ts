import type { BuildConfig } from './types.js';
import { runStageTasks, type StageHandler } from './runner.js';
import { createTransformHandler } from './transform/transformStage.js';
import { createVtHandler } from './vt/vtStage.js';
export type {
  BandConfig,
  BuildConfig,
  TaskRecord,
  TransformStageConfig,
  TransformStageContext,
  TransformTaskInput,
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
export { createTransformHandler } from './transform/transformStage.js';
export { createVtHandler } from './vt/vtStage.js';

export async function runPipeline<TTransformInput = unknown, TVtInput = unknown>(
  buildConfig: BuildConfig<TTransformInput, TVtInput>
): Promise<void> {
  await runTransform(buildConfig);
  await runVt(buildConfig);
}

export async function runTransform<TTransformInput = unknown, TVtInput = unknown>(
  buildConfig: BuildConfig<TTransformInput, TVtInput>
): Promise<void> {
  const handler = buildConfig.transformHandler
    ?? (buildConfig.transformContext
      ? (createTransformHandler(buildConfig.transformContext) as unknown as StageHandler<TTransformInput>)
      : undefined);
  if (!handler) {
    throw new Error('transformHandler is required to run transform stage.');
  }
  await runStageTasks({
    db: buildConfig.taskQueue,
    nodeId: buildConfig.nodeId,
    stage: 'transform',
    handler,
  });
}

export async function runVt<TTransformInput = unknown, TVtInput = unknown>(
  buildConfig: BuildConfig<TTransformInput, TVtInput>
): Promise<void> {
  const handler = buildConfig.vtHandler
    ?? (buildConfig.vtContext
      ? (createVtHandler(buildConfig.vtContext) as unknown as StageHandler<TVtInput>)
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
