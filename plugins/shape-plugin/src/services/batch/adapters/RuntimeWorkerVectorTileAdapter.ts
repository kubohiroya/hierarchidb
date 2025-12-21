import type { ProgressInfo } from '../../../common/types/index.js';
import type { VectorTileTask } from '../../../common/types/index.js';
import type { VectorTileStageAdapter } from './VectorTileStageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';
import { shapeDB } from '../../database/ShapeDB.js';

export class RuntimeWorkerVectorTileAdapter implements VectorTileStageAdapter {
  async process(tasks: VectorTileTask[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const client = await getShapeRuntimeWorkerClient();
    const vectorTileClient = client?.vectortile;
    if (!vectorTileClient) throw new Error('Runtime worker vectortile not available');
    let completed = 0, failed = 0;
    let metadataReplace = true;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
      }
      try {
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'running',
            startedAt: Date.now(),
            progress: 0,
          });
        }
        const inputBufferId = task.config?.inputBufferId ?? '';
        const compression = task.config?.compression ?? false;
        const format = (task.config?.format ?? 'mvt') as 'mvt';
        const tileSize = task.config?.tileSize ?? 256;
        const buffer = task.config?.buffer;
        const minZoom = task.config?.minZoom;
        const maxZoom = task.config?.maxZoom;
        const metadataEnabled = Boolean(task.config?.metadataEnabled);
        const replace = metadataEnabled && metadataReplace;
        if (metadataEnabled) {
          metadataReplace = false;
        }
        await vectorTileClient.generateTiles(inputBufferId, {
          format,
          compression: compression ? 'gzip' : 'none',
          tileSize,
          buffer,
          minZoom,
          maxZoom,
          metadataEnabled,
          metadataReplace: replace,
          metadataContext: task.config?.metadataContext,
        });
        completed++;
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'completed',
            completedAt: Date.now(),
            progress: 100,
          });
        }
      } catch (error) {
        failed++;
        if (task.taskId) {
          await shapeDB.updateBatchTask(task.taskId, {
            status: 'failed',
            completedAt: Date.now(),
            progress: 100,
            errorMessage: error instanceof Error ? error.message : 'Vector tile generation failed',
          });
        }
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'vectortile', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}
