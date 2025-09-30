import type { NodeId } from '@hierarchidb/common-type';
import { BatchService } from '@hierarchidb/batch';
import type { DownloadTask } from '../../types.js';
import type { ProgressInfo } from '../../../shared/index.js';
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
  async process(
    sessionId: string,
    _nodeId: NodeId,
    tasks: DownloadTask[],
    onProgress: (p: ProgressInfo) => void,
    controls?: StageControls,
  ): Promise<DownloadStageAdapterResult> {
    // Require a runtime worker client (no fallback here)
    const client = await getShapeRuntimeWorkerClient();
    if (!client) throw new Error('Runtime worker client not available for download stage');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    await batch.mapChunks<DownloadTask>(
      tasks,
      async (task, index) => {
        if (controls?.waitIfPaused) {
          await controls.waitIfPaused();
        }
        const fileId = `${sessionId}-download-${index}`;
        try {
        const downloadUrl = task.url ?? task.config?.url;
        if (!downloadUrl) {
          throw new Error(`Download task ${task.taskId} missing url`);
        }
        const res = await client.download.download(downloadUrl, fileId);
          totalBytes += res.sizeBytes || 0;
          completed++;
        } catch {
          failed++;
        }
        onProgress({
          total: tasks.length,
          completed,
          failed,
          skipped: 0,
          percentage: (completed / tasks.length) * 100,
          currentStage: 'download',
          currentTask: task.taskId,
        });
      },
      { concurrency: 4 },
    );

    return { processed: completed, failed, totalDownloadSize: totalBytes };
  }
}
