import type { NodeId } from '@hierarchidb/common-type';
import { BatchService } from '@hierarchidb/batch';
import type { DownloadTask } from '../../types';
import type { ProgressInfo } from '../../../shared';
import type { DownloadStageAdapter, DownloadStageAdapterResult } from './DownloadStageAdapter';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient';

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
  ): Promise<DownloadStageAdapterResult> {
    // Require a runtime worker client (no fallback here)
    const client = await getShapeRuntimeWorkerClient();
    if (!client) throw new Error('Runtime worker client not available for download stage');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;

    await batch.mapChunks(
      tasks,
      async (task, index) => {
        const fileId = `${sessionId}-download-${index}`;
        try {
          const res = await client.download.download(task.url, fileId);
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
