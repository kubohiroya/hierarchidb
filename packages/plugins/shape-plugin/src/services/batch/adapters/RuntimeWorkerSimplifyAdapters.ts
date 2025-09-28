import type { ProgressInfo } from '../../../shared/index.js';
import type { Simplify1Task, Simplify2Task } from '../../types.js';
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
        await client.simplify.simplifyStage1(task.inputBufferId, { tolerance: task.tolerance, minArea: task.minArea });
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
        await client.simplify.simplifyStage2(task.inputBufferId, { zoomLevels: task.zoomLevels, tileSize: task.tileSize });
        completed++;
      } catch {
        failed++;
      }
      onProgress({ total: tasks.length, completed, failed, skipped: 0, percentage: (completed / tasks.length) * 100, currentStage: 'simplify2', currentTask: task.taskId });
    }
    return { processed: completed, failed };
  }
}
