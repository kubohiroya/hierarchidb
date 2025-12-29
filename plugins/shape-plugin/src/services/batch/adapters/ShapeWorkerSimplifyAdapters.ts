import type { ProgressInfo, Simplify1Task, Simplify2Task } from '../../../common/types/index.js';
import type { Simplify1StageAdapter } from './Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './Simplify2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { BatchService } from '@hierarchidb/batch';
import { ShapeWorkerPool } from './ShapeWorkerPool.js';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

export class ShapeWorkerSimplify1Adapter implements Simplify1StageAdapter {
  async process(tasks: Simplify1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    try {
      await batch.mapChunks(tasks, async (task, index) => {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          return;
        }
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'running',
            startedAt: Date.now(),
            progress: 0,
          });
        }
        try {
          const taskIndex = task.index ?? index;
          const result = await workerPool.run((api) => api.processSimplify1Task({
            nodeId: String(task.nodeId ?? ''),
            task,
            taskIndex,
          }));
          if (result.status === 'failed') {
            failed += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: result.errorMessage ?? 'Simplify stage 1 failed',
              });
            }
          } else if (result.status === 'skipped') {
            skipped += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
                message: 'skipped',
              });
            }
          } else {
            completed += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'completed',
                completedAt: Date.now(),
                progress: 100,
              });
            }
          }
        } catch (error) {
          if (shouldAbort() || isAbortError(error)) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
            }
            return;
          }
          failed += 1;
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: error instanceof Error ? error.message : 'Simplify stage 1 failed',
            });
          }
        }
        if (shouldAbort()) {
          return;
        }
        const total = tasks.length;
        const done = completed + failed + skipped;
        onProgress({
          total,
          completed,
          failed,
          skipped,
          percentage: total > 0 ? (done / total) * 100 : 0,
          currentStage: 'simplify1',
          currentTask: task.taskId,
        });
      }, { concurrency: workerPool.size });
    } finally {
      await workerPool.shutdown();
    }
    return { processed: completed, failed };
  }
}

export class ShapeWorkerSimplify2Adapter implements Simplify2StageAdapter {
  async process(tasks: Simplify2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const batch = new BatchService();
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    try {
      await batch.mapChunks(tasks, async (task, index) => {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        if (shouldAbort()) {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          return;
        }
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'running',
            startedAt: Date.now(),
            progress: 0,
          });
        }
        try {
          const taskIndex = task.index ?? index;
          const simplify1TaskId = `${task.nodeId ?? ''}-simplify1-${taskIndex}`;
          const simplify1Task = await shapeDB.batchTasks.get(simplify1TaskId);
          if (simplify1Task?.status === 'failed') {
            failed += 1;
            if (task.taskId) {
              await shapeDB.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: 'Simplify1 failed for this task',
              });
            }
          } else {
            const result = await workerPool.run((api) => api.processSimplify2Task({
              nodeId: String(task.nodeId ?? ''),
              task,
              taskIndex,
            }));
            if (result.status === 'failed') {
              failed += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'failed',
                  completedAt: Date.now(),
                  progress: 100,
                  errorMessage: result.errorMessage ?? 'Simplify stage 2 failed',
                });
              }
            } else if (result.status === 'skipped') {
              skipped += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: 'skipped',
                });
              }
            } else {
              completed += 1;
              if (task.taskId) {
                await shapeDB.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                });
              }
            }
          }
        } catch (error) {
          if (shouldAbort() || isAbortError(error)) {
            if (controls?.waitIfPaused) {
              await controls.waitIfPaused();
            }
            return;
          }
          failed += 1;
          if (task.taskId) {
            await shapeDB.updateBatchTask(task.taskId, {
              status: 'failed',
              completedAt: Date.now(),
              progress: 100,
              errorMessage: error instanceof Error ? error.message : 'Simplify stage 2 failed',
            });
          }
        }
        if (shouldAbort()) {
          return;
        }
        const total = tasks.length;
        const done = completed + failed + skipped;
        onProgress({
          total,
          completed,
          failed,
          skipped,
          percentage: total > 0 ? (done / total) * 100 : 0,
          currentStage: 'simplify2',
          currentTask: task.taskId,
        });
      }, { concurrency: workerPool.size });
    } finally {
      await workerPool.shutdown();
    }
    return { processed: completed, failed };
  }
}
