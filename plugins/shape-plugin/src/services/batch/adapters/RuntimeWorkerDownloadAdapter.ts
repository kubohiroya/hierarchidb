import type { NodeId } from '@hierarchidb/common-types';
import { BatchService, createLaneSemaphoreRegistry } from '@hierarchidb/batch';
import type { DownloadTask } from '../../../common/types/index.js';
import type { ProgressInfo } from '../../../common/types/index.js';
import type { DownloadStageAdapter, DownloadStageAdapterResult } from './DownloadStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { shapeDB } from '../../database/ShapeDB.js';
import { ShapeWorkerPool } from './ShapeWorkerPool.js';

const isAbortError = (error: unknown): boolean => (
  error instanceof Error && error.name === 'AbortError'
);

/**
 * RuntimeWorkerDownloadAdapter
 *
 * Scaffolds a runtime-worker-worker based download stage behind a stable adapter.
 * For now it leverages the shared DownloadService and keeps progress semantics.
 * Later this will dispatch tasks to @hierarchidb/runtime-worker-worker workers.
 */
export class RuntimeWorkerDownloadAdapter implements DownloadStageAdapter {
  private readonly laneRegistry = createLaneSemaphoreRegistry({
    defaults: {
      gadm: 2,
      osm: 1,
      naturalearth: 2,
      openmaptiles: 1,
      default: 4,
    },
    envKey: 'SHAPE_LANE_LIMITS',
    fallback: 4,
  });

  async process(
    sessionId: string,
    nodeId: NodeId,
    tasks: DownloadTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult> {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    console.debug('[ShapeDownloadAdapter] process', {
      sessionId,
      taskCount: tasks.length,
      dataSources: Array.from(new Set(tasks.map((task) => task.config?.dataSource ?? 'unknown'))),
    });
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    const recommendedConcurrency = this.laneRegistry.recommendConcurrency(
      tasks.map((task) => (task.config?.dataSource ?? 'default').toLowerCase()),
      4,
    );
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? recommendedConcurrency);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);

    try {
      await batch.mapChunks<DownloadTask, {}>(
        tasks,
        async (task: DownloadTask, index: number) => {
          const lane = (task.config?.dataSource ?? 'default').toLowerCase();
          await this.laneRegistry.runWithLane(lane, async () => {
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
              const result = await workerPool.run((api) => api.processDownloadTask({
                sessionId,
                nodeId,
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
                    errorMessage: result.errorMessage ?? 'Download failed',
                  });
                }
              } else {
                completed += 1;
                totalBytes += result.bytesWritten ?? 0;
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
                  errorMessage: error instanceof Error ? error.message : 'Download failed',
                });
              }
            }
            if (shouldAbort()) {
              return;
            }
            onProgress({
              total: tasks.length,
              completed,
              failed,
              skipped: 0,
              percentage: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
              currentStage: 'download',
              currentTask: task.taskId,
            });
          });
        },
        { concurrency: workerPool.size },
      );
    } finally {
      await workerPool.shutdown();
    }

    return { processed: completed, failed, totalDownloadSize: totalBytes };
  }
}
