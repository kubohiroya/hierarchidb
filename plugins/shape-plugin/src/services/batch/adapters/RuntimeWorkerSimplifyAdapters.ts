import type { ProgressInfo } from '../../../common/shared/index.js';
import type { Simplify1Task, Simplify2Task } from '../../common/types.js';
import type { Simplify1StageAdapter } from './Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './Simplify2StageAdapter.js';
import type { StageControls } from './StageControls.js';
import { getShapeRuntimeWorkerClient } from './RuntimeWorkerClient.js';

export class RuntimeWorkerSimplify1Adapter implements Simplify1StageAdapter {
  async process(tasks: Simplify1Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const client = await getShapeRuntimeWorkerClient();
    if (!client) throw new Error('Runtime worker simplify1 not available');
    let completed = 0, failed = 0;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
      }
      try {
        const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
        const tolerance = task.tolerance ?? task.config?.tolerance ?? 0.001;
        const minArea = task.minArea ?? task.config?.minimumArea ?? 0;
        await client.simplify.simplifyStage1(inputBufferId, { tolerance, minArea });
        completed++;
      } catch {
        failed++;
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'simplify1', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}

export class RuntimeWorkerSimplify2Adapter implements Simplify2StageAdapter {
  async process(tasks: Simplify2Task[], onProgress: (p: ProgressInfo) => void, controls?: StageControls) {
    const client = await getShapeRuntimeWorkerClient();
    if (!client) throw new Error('Runtime worker simplify2 not available');
    let completed = 0, failed = 0;
    for (const task of tasks) {
      if (controls?.waitIfPaused) {
        await controls.waitIfPaused();
      }
      try {
        const inputBufferId = task.inputBufferId ?? task.config?.inputBufferId ?? '';
        const zoomLevels = task.zoomLevels ?? task.config?.zoomLevels ?? [];
        const tileSize = task.tileSize ?? task.config?.tileSize ?? 256;
        await client.simplify.simplifyStage2(inputBufferId, { zoomLevels, tileSize });
        completed++;
      } catch {
        failed++;
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'simplify2', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}
