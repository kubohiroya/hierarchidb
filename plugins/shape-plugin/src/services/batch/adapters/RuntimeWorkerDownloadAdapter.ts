import type { NodeId } from '@hierarchidb/common-types';
import { BatchService, createLaneSemaphoreRegistry } from '@hierarchidb/batch-runtime-services';
import type { DownloadTask } from '../../common/types.js';
import type { ProgressInfo } from '../../../common/shared/index.js';
import type { DownloadStageAdapter, DownloadStageAdapterResult } from './DownloadStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';

/**
 * RuntimeWorkerDownloadAdapter
 *
 * Scaffolds a runtime-worker based download stage behind a stable adapter.
 * For now it leverages the shared DownloadService and keeps progress semantics.
 * Later this will dispatch tasks to @hierarchidb/runtime-worker workers.
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
    _nodeId: NodeId,
    tasks: DownloadTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult> {
    // Require a runtime worker client (no fallback here)
    const client = await getShapeRuntimeWorkerClient();
    const downloadClient = client?.download;
    if (!downloadClient) {
      throw new Error('Runtime worker client not available for download stage');
    }
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    const recommendedConcurrency = this.laneRegistry.recommendConcurrency(
      tasks.map((task) => (task.config?.dataSource ?? 'default').toLowerCase()),
      4,
    );

    await batch.mapChunks<DownloadTask, {}>(
      tasks,
      async (task, index) => {
        const lane = (task.config?.dataSource ?? 'default').toLowerCase();
        await this.laneRegistry.runWithLane(lane, async () => {
          if (controls?.waitIfPaused) {
            await controls.waitIfPaused();
          }
          const fileId = `${sessionId}-download-${index}`;
          try {
            const downloadUrl = task.url ?? task.config?.url;
            if (!downloadUrl) {
              throw new Error(`Download task ${task.taskId} missing url`);
            }
            const res = await downloadClient.download(downloadUrl, fileId);
            totalBytes += res.sizeBytes || 0;
            completed += 1;
          } catch {
            failed += 1;
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
      { concurrency: recommendedConcurrency },
    );

    return { processed: completed, failed, totalDownloadSize: totalBytes };
  }
}
