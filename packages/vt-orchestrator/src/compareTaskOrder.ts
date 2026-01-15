import { listTasksByStage, updateTask, VtTaskQueueDb } from './task/taskQueue.js';
import type { RunStageOptions, TaskQueueRecord } from './types/types.js';

const compareTaskOrder = (a: TaskQueueRecord, b: TaskQueueRecord): number => {
  const pa = a.stagePriority ?? 0;
  const pb = b.stagePriority ?? 0;
  if (pa !== pb) return pa - pb;
  return a.index - b.index;
};

export async function runStageTasks<TInput = unknown, TOutput = unknown>(
  options: RunStageOptions<TInput, TOutput>
): Promise<void> {
  const { nodeId, stage, handler, waitIfPaused } = options;
  const db = new VtTaskQueueDb();
  const tasks = await listTasksByStage(db, nodeId, stage);
  const pending = tasks.filter((task) => task.status === 'queued').sort(compareTaskOrder);

  for (const task of pending) {
    if (waitIfPaused) {
      await waitIfPaused();
    }
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
