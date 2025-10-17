import type { ProgressInfo } from '../../../common/shared/index.js';
import type { VectorTileTask } from '../../common/types.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  async process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const client = await getShapeRuntimeWorkerClient();
    const vectorTileClient = client?.vectortile;
    if (!vectorTileClient) throw new Error('Runtime worker vectortile not available');
    let completed = 0, failed = 0;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
      }
      try {
        const inputBufferId =
          task.inputBufferId ??
          task.config?.inputBufferId ??
          task.config?.tileBufferId ??
          '';
        const compression = task.compression ?? task.config?.compression ?? false;
        const format = (task.outputFormat ?? task.config?.format ?? 'mvt') as 'mvt';
        const tileSize = task.config?.tileSize ?? 256;
        await vectorTileClient.generateTiles(
          inputBufferId,
          {
            format,
            compression: compression ? 'gzip' : 'none',
            tileSize,
          } as any,
        );
        completed++;
      } catch {
        failed++;
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'vectortile', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}
