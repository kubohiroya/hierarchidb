import type { ProgressInfo } from '../../../shared/index.js';
import type { VectorTileTask } from '../../types.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  async process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void) {
    const client = await getShapeRuntimeWorkerClient();
    if (!client) throw new Error('Runtime worker vectortile not available');
    let completed = 0, failed = 0;
    for (const task of tasks) {
      try {
        await client.vectortile.generateTiles(task.inputBufferId, { format: task.outputFormat as any, compression: task.compression as any });
        completed++;
      } catch {
        failed++;
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'vectortile', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}

