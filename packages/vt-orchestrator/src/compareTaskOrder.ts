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
  const baseMaxConcurrent = Math.max(1, Math.floor(maxConcurrent ?? 1));
  const dynamicConfig = options.dynamicConcurrency?.enabled ? options.dynamicConcurrency : null;
  const minConcurrent = dynamicConfig
    ? Math.max(1, Math.floor(dynamicConfig.minConcurrent))
    : baseMaxConcurrent;
  const maxConcurrentLimit = dynamicConfig
    ? Math.max(minConcurrent, Math.floor(dynamicConfig.maxConcurrent ?? baseMaxConcurrent))
    : baseMaxConcurrent;
  let desiredConcurrent = dynamicConfig
    ? Math.min(maxConcurrentLimit, baseMaxConcurrent)
    : baseMaxConcurrent;
  desiredConcurrent = Math.max(minConcurrent, desiredConcurrent);
  let cursor = 0;
  let aborted = false;
  let failureError: Error | null = null;
  let failureTaskId: string | null = null;
  let activeWorkers = 0;
  const workerPromises: Promise<void>[] = [];
  let loggedSummary = false;
  let loggedTaskStart = 0;
  let loggedTaskUpdate = 0;
  let loggedTaskDone = 0;
  let loggedTaskError = 0;
  let loggedPauseWait = 0;
  const maxTaskLogs = 2;

  const extractTaskId = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') return null;
    const candidate = (error as { taskId?: string }).taskId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  };

  const normalizeErrorMessage = (error: unknown): string => {
    const base = error instanceof Error ? error.message : String(error);
    const taskId = extractTaskId(error);
    return taskId ? `${base} (failedTaskId=${taskId})` : base;
  };

  const abortAll = (error: Error, taskId: string) => {
    if (aborted) return;
    aborted = true;
    (error as { taskId?: string }).taskId = taskId;
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
      message: errorMessage,
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

  const hasPendingTasks = () => cursor < pending.length;

  const readHeapUsageRatio = (): number | null => {
    const memory = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } } })
      .performance?.memory;
    if (!memory) return null;
    const used = memory.usedJSHeapSize ?? 0;
    const limit = memory.jsHeapSizeLimit ?? 0;
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
    return used / limit;
  };

  const logStageSummary = (): void => {
    if (loggedSummary) return;
    loggedSummary = true;
    const heapRatio = readHeapUsageRatio();
    console.warn('[vt-orchestrator][runStageTasks] stage summary', {
      nodeId,
      stage,
      pending: pending.length,
      desiredConcurrent,
      maxConcurrentLimit,
      heapUsedRatio: heapRatio,
    });
  };

  const adjustConcurrency = (): void => {
    if (!dynamicConfig) return;
    const usageRatio = readHeapUsageRatio();
    if (usageRatio === null) return;
    if (usageRatio >= dynamicConfig.highWatermark) {
      desiredConcurrent = Math.max(minConcurrent, desiredConcurrent - Math.max(1, dynamicConfig.adjustStep));
      return;
    }
    if (usageRatio <= dynamicConfig.lowWatermark) {
      desiredConcurrent = Math.min(maxConcurrentLimit, desiredConcurrent + Math.max(1, dynamicConfig.adjustStep));
    }
  };

  const runNext = async () => {
    while (true) {
      logStageSummary();
      if (aborted || abortSignal?.aborted) return;
      if (activeWorkers > desiredConcurrent) return;
      const index = cursor;
      cursor += 1;
      const task = pending[index];
      if (!task) return;
      if (waitIfPaused) {
        const pauseWaitStartedAt = Date.now();
        await waitIfPaused();
        const pauseWaitElapsedMs = Date.now() - pauseWaitStartedAt;
        if (pauseWaitElapsedMs > 0 && loggedPauseWait < maxTaskLogs) {
          loggedPauseWait += 1;
          console.warn('[vt-orchestrator][runStageTasks] pause wait resolved', {
            nodeId,
            stage,
            taskId: task.taskId,
            waitMs: pauseWaitElapsedMs,
          });
        }
      }
      if (aborted || abortSignal?.aborted) return;
      if (loggedTaskStart < maxTaskLogs) {
        loggedTaskStart += 1;
        const inputKeys = task.inputData && typeof task.inputData === 'object'
          ? Object.keys(task.inputData as Record<string, unknown>)
          : null;
        console.warn('[vt-orchestrator][runStageTasks] task start', {
          nodeId,
          stage,
          taskId: task.taskId,
          index,
          inputKeys,
        });
      }
      await updateTask(db, task.taskId, {
        status: 'running',
        startedAt: Date.now(),
        progress: 0,
      });
      if (loggedTaskUpdate < maxTaskLogs) {
        loggedTaskUpdate += 1;
        console.warn('[vt-orchestrator][runStageTasks] task status updated', {
          nodeId,
          stage,
          taskId: task.taskId,
        });
      }

      try {
        const result = await handler(task as TaskQueueRecord<TInput, TOutput>);
        if (loggedTaskDone < maxTaskLogs) {
          loggedTaskDone += 1;
          console.warn('[vt-orchestrator][runStageTasks] task done', {
            nodeId,
            stage,
            taskId: task.taskId,
            status: result.status ?? 'completed',
            progress: result.progress ?? 100,
          });
        }
        if (stopOnFailure && (aborted || abortSignal?.aborted) && task.taskId !== failureTaskId) {
          const reason = failureError ? failureError.message : 'aborted';
          await markTaskFailed(task.taskId, `aborted: ${reason}`);
          return;
        }
        const nextStatus = result.status ?? 'completed';
        const taskUpdated = Boolean(result.taskUpdated);
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
        if (taskUpdated) {
          continue;
        }
        await updateTask(db, task.taskId, {
          status: nextStatus,
          progress: result.progress ?? 100,
          message: result.message,
          metadata: result.metadata,
          outputData: result.outputData,
          errorMessage: result.errorMessage,
          completedAt: Date.now(),
        });
      } catch (error) {
        if (loggedTaskError < maxTaskLogs) {
          loggedTaskError += 1;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(
            `[vt-orchestrator][runStageTasks] task error`
            + ` nodeId=${nodeId}`
            + ` stage=${stage}`
            + ` taskId=${task.taskId}`
            + ` error=${errorMessage}`,
          );
        }
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

  const startWorker = () => {
    activeWorkers += 1;
    const promise = runNext()
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        activeWorkers -= 1;
        if (dynamicConfig) {
          syncWorkers();
        }
      });
    workerPromises.push(promise);
  };

  const syncWorkers = (): void => {
    if (!hasPendingTasks()) return;
    while (activeWorkers < desiredConcurrent) {
      startWorker();
    }
  };

  if (dynamicConfig) {
    const sampleMs = Math.max(200, Math.floor(dynamicConfig.sampleMs));
    const intervalId = setInterval(() => {
      adjustConcurrency();
      syncWorkers();
    }, sampleMs);
    syncWorkers();
    await Promise.all(workerPromises);
    clearInterval(intervalId);
  } else {
    while (activeWorkers < desiredConcurrent) {
      startWorker();
    }
    await Promise.all(workerPromises);
  }

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
