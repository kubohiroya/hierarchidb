import type { TaskQueueRecord, TaskStage, TaskStatus, VtTaskQueueDb } from './task/taskQueue.js';
import { listTasksByStage, updateTask } from './task/taskQueue.js';

export type StageHandlerResult<TOutput = unknown> = {
  status?: TaskStatus;
  message?: string;
  progress?: number;
  outputData?: TOutput;
  errorMessage?: string;
};

export type StageHandler<TInput = unknown, TOutput = unknown> = (
  task: TaskQueueRecord<TInput, TOutput>
) => Promise<StageHandlerResult<TOutput>>;

export interface RunStageOptions<TInput = unknown, TOutput = unknown> {
  db: VtTaskQueueDb;
  nodeId: TaskQueueRecord['nodeId'];
  stage: TaskStage;
  handler: StageHandler<TInput, TOutput>;
}

const compareTaskOrder = (a: TaskQueueRecord, b: TaskQueueRecord): number => {
  const pa = a.stagePriority ?? 0;
  const pb = b.stagePriority ?? 0;
  if (pa !== pb) return pa - pb;
  return a.index - b.index;
};

export async function runStageTasks<TInput = unknown, TOutput = unknown>(
  options: RunStageOptions<TInput, TOutput>
): Promise<void> {
  const { db, nodeId, stage, handler } = options;
  const tasks = await listTasksByStage(db, nodeId, stage);
  const pending = tasks.filter((task) => task.status === 'waiting').sort(compareTaskOrder);

  for (const task of pending) {
    await updateTask(db, task.taskId, {
      status: 'running',
      startedAt: Date.now(),
      progress: 0,
    });

    try {
      const result = await handler(task as TaskQueueRecord<TInput, TOutput>);
      const nextStatus = result.status ?? 'completed';
      await updateTask(db, task.taskId, {
        status: nextStatus,
        progress: result.progress ?? 100,
        message: result.message,
        outputData: result.outputData,
        errorMessage: result.errorMessage,
        completedAt: Date.now(),
      });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await updateTask(db, task.taskId, {
        status: 'failed',
        errorMessage: err,
        completedAt: Date.now(),
      });
    }
  }
}
