import type { NodeId } from '@hierarchidb/common-types';
import { BatchService, createLaneSemaphoreRegistry } from '@hierarchidb/batch';
import type { DownloadTask, DownloadTaskPayload } from '../../../common/types/index.js';
import type { ProgressInfo } from '../../../common/types/index.js';
import type { DownloadStageAdapter, DownloadStageAdapterResult } from './DownloadStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getShapeDbApiClient } from '../ShapeBatchApiClient.js';
import { ShapeWorkerPool } from './ShapeWorkerPool.js';

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return 'unknown size';
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)}MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)}GB`;
};

const buildDownloadCompletionMessage = (
  url?: string,
  bytesWritten?: number,
): string | undefined => {
  if (!url) return undefined;
  if (typeof bytesWritten !== 'number') return url;
  return `${url} (Size: ${formatBytes(bytesWritten)})`;
};

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
    nodeId: NodeId,
    tasks: DownloadTask[],
    inputsByTaskId: Map<string, DownloadTaskPayload>,
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult> {
    const getSignal = controls?.getSignal;
    const shouldAbort = () => Boolean(getSignal?.()?.aborted);
    const dataSources = tasks.map((task) => {
      const input = inputsByTaskId.get(task.taskId);
      if (!input) {
        throw new Error(`[ShapeDownloadAdapter] Missing input for task ${task.taskId}`);
      }
      return input.dataSource;
    });
    console.debug('[ShapeDownloadAdapter] process', {
      nodeId,
      taskCount: tasks.length,
      dataSources: Array.from(new Set(dataSources)),
    });
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    const recommendedConcurrency = this.laneRegistry.recommendConcurrency(
      dataSources.map((source) => source.toLowerCase()),
      4,
    );
    const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? recommendedConcurrency);
    const workerPool = await ShapeWorkerPool.create(maxConcurrent);

    try {
      await batch.mapChunks<DownloadTask, unknown>(
        tasks,
        async (task: DownloadTask, index: number) => {
          const input = inputsByTaskId.get(task.taskId);
          if (!input) {
            throw new Error(`[ShapeDownloadAdapter] Missing input for task ${task.taskId}`);
          }
          const lane = input.dataSource.toLowerCase();
          await this.laneRegistry.runWithLane(lane, async () => {
            if (controls?.waitIfPaused) await controls.waitIfPaused();
            if (shouldAbort()) return;

            if (task.taskId) {
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'running',
                startedAt: Date.now(),
                progress: 0,
              });
            }

            try {
              const taskIndex = task.index ?? index;
              const result = await workerPool.run((api) => api.processDownloadTask({
                nodeId,
                task,
                taskIndex,
                input,
              }));
              if (shouldAbort()) return;

              if (result.status === 'failed') {
                failed += 1;
                if (task.taskId) {
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
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
                  const url = input.url ?? task.url;
                await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                  status: 'completed',
                  completedAt: Date.now(),
                  progress: 100,
                  message: buildDownloadCompletionMessage(url, result.bytesWritten),
                });
                }
              }
            } catch (error) {
              if (shouldAbort()) return;
              failed += 1;
              if (task.taskId) {
              await getShapeDbApiClient().ephemeral.updateBatchTask(task.taskId, {
                status: 'failed',
                completedAt: Date.now(),
                progress: 100,
                errorMessage: error instanceof Error ? error.message : 'Download failed',
              });
              }
            }

            if (shouldAbort()) return;
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
