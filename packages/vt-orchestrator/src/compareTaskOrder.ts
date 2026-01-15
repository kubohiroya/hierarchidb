import { listTasksByStage, listTasksByStageAndStatus, updateTask, VtTaskQueueDb } from './task/taskQueue.js';
import type { FailureHandling, RunStageOptions, TaskQueueRecord } from './types/types.js';

const compareTaskOrder = (a: TaskQueueRecord, b: TaskQueueRecord): number => {
  const pa = a.stagePriority ?? 0;
  const pb = b.stagePriority ?? 0;
  if (pa !== pb) return pa - pb;
  return a.index - b.index;
};

export async function runStageTasks<TInput = unknown, TOutput = unknown>(
  options: RunStageOptions<TInput, TOutput>
): Promise<void> {
  const { nodeId, stage, handler, waitIfPaused, maxConcurrent } = options;
  const failureHandling: FailureHandling = options.failureHandling ?? 'continue';
  const stopOnFailure = failureHandling === 'stop';
  const skipOnFailure = failureHandling === 'skip';
  const abortController = options.abortController ?? (stopOnFailure ? new AbortController() : undefined);
  const abortSignal = abortController?.signal;
  const db = new VtTaskQueueDb();
  const tasks = await listTasksByStage(db, nodeId, stage);
  const pending = tasks.filter((task) => task.status === 'queued').sort(compareTaskOrder);
  const concurrency = Math.max(1, Math.floor(maxConcurrent ?? 1));
  let cursor = 0;
  let aborted = false;
  let failureError: Error | null = null;
  let failureTaskId: string | null = null;

  const normalizeErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
  );

  const abortAll = (error: Error, taskId: string) => {
    if (aborted) return;
    aborted = true;
    failureError = error;
    failureTaskId = taskId;
    if (abortSignal && !abortSignal.aborted) {
      abortController?.abort();
    }
  };

  const markTaskFailed = async (taskId: string, errorMessage: string): Promise<void> => {
    await updateTask(db, taskId, {
      status: 'failed',
      errorMessage,
      completedAt: Date.now(),
    });
  };

  const markTaskSkipped = async (taskId: string, reason: string): Promise<void> => {
    await updateTask(db, taskId, {
      status: 'completed',
      progress: 100,
      message: `skipped: ${reason}`,
      completedAt: Date.now(),
    });
  };

  const runNext = async () => {
    while (true) {
      if (aborted || abortSignal?.aborted) return;
      const index = cursor;
      cursor += 1;
      const task = pending[index];
      if (!task) return;
      if (waitIfPaused) {
        await waitIfPaused();
      }
      if (aborted || abortSignal?.aborted) return;
      await updateTask(db, task.taskId, {
        status: 'running',
        startedAt: Date.now(),
        progress: 0,
      });

      try {
        const result = await handler(task as TaskQueueRecord<TInput, TOutput>);
        if (stopOnFailure && (aborted || abortSignal?.aborted) && task.taskId !== failureTaskId) {
          const reason = failureError ? failureError.message : 'aborted';
          await markTaskFailed(task.taskId, `aborted: ${reason}`);
          return;
        }
        const nextStatus = result.status ?? 'completed';
        if (nextStatus === 'failed') {
          const errorMessage = result.errorMessage ?? 'stage task failed';
          if (skipOnFailure) {
            await markTaskSkipped(task.taskId, errorMessage);
            continue;
          }
          await markTaskFailed(task.taskId, errorMessage);
          if (stopOnFailure) {
            abortAll(new Error(errorMessage), task.taskId);
            return;
          }
          continue;
        }
        await updateTask(db, task.taskId, {
          status: nextStatus,
          progress: result.progress ?? 100,
          message: result.message,
          outputData: result.outputData,
          errorMessage: result.errorMessage,
          completedAt: Date.now(),
        });
      } catch (error) {
        const err = normalizeErrorMessage(error);
        if (skipOnFailure) {
          await markTaskSkipped(task.taskId, err);
          continue;
        }
        await markTaskFailed(task.taskId, err);
        if (stopOnFailure) {
          abortAll(new Error(err), task.taskId);
          return;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runNext()));

  if (stopOnFailure && failureError) {
    const reason = normalizeErrorMessage(failureError ?? 'aborted');
    const [queued, running] = await Promise.all([
      listTasksByStageAndStatus(db, nodeId, stage, 'queued'),
      listTasksByStageAndStatus(db, nodeId, stage, 'running'),
    ]);
    await Promise.all(
      [...queued, ...running].map((task) => (
        markTaskFailed(task.taskId, `aborted: ${reason}`)
      ))
    );
    throw failureError;
  }
}
