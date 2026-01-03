import { describe, expect, it, vi } from 'vitest';

import type { VectorTileTask } from '../../../../../common/types/index.js';
import type { ShapeVectorTileTaskInputData } from '@hierarchidb/plugin-service-api';

import { runVectorTileStageOrchestrator } from './runVectorTileStageOrchestrator.js';

import type { VectorTileStageAdapter } from '../../../adapters/VectorTileStageAdapter.js';
import type { RunVectorTileStageOrchestratorParams } from './orchestratorTypes.js';

function makeTask(i: number): VectorTileTask {
  return {
    taskId: `vt:${i}`,
    taskType: 'vectortile',
    nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
    stage: 'wait',
    status: 'waiting',
    index: i,
    progress: 0,
  };
}

function makeInputs(tasks: VectorTileTask[]): Map<string, ShapeVectorTileTaskInputData> {
  const map = new Map<string, ShapeVectorTileTaskInputData>();
  for (const t of tasks) {
    // orchestrator は inputsByTaskId を registerTasks に渡すだけなので、ここでは最小限で良い。
    map.set(t.taskId, {
      inputBufferId: `buf:${t.index ?? 0}`,
      tileZ: 0,
      tileX: t.index ?? 0,
      tileY: t.index ?? 0,
    });
  }
  return map;
}

describe('vectortile orchestrator (stage-agnostic contract)', () => {
  it('when runnableTasks is empty, it should report base progress and skip adapter/postprocess', async () => {
    const tasks = [makeTask(0), makeTask(1)];

    const progressCallback = vi.fn();
    const afterRun = vi.fn(async () => {});

    const adapter: VectorTileStageAdapter = {
      process: vi.fn(async () => ({ processed: 0, failed: 0 })),
    };

    const taskRegistry: RunVectorTileStageOrchestratorParams['taskRegistry'] = {
      registerTasks: vi.fn(async () => {}),
      resolveStageTasks: vi.fn(async () => ({
        runnableTasks: [],
        completedCount: 2,
        failedCount: 0,
        total: 2,
      })),
    };

    const postprocess = {
      persistPlaceholderMetadata: vi.fn(async () => 0),
      syncVectorTilesToShapeStore: vi.fn(async () => {}),
      summarizeVectorTilesByOrigin: vi.fn(async () => new Map()),
      updateSourceMetadataStage: vi.fn(async () => {}),
    };

    await runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      maxConcurrent: 2,
      // Plan A: controls omitted
      progressCallback,
      progressFactory: (p) => p,
      postprocess,
      afterRun,
    });

    expect(taskRegistry.registerTasks).toHaveBeenCalledTimes(1);
    expect(taskRegistry.resolveStageTasks).toHaveBeenCalledTimes(1);

    // Adapter shouldn't run if nothing is runnable
    expect(adapter.process).not.toHaveBeenCalled();

    // Postprocess shouldn't run either
    expect(postprocess.persistPlaceholderMetadata).not.toHaveBeenCalled();
    expect(postprocess.syncVectorTilesToShapeStore).not.toHaveBeenCalled();

    // Progress should reflect baseCompleted
    expect(progressCallback).toHaveBeenCalledTimes(1);
    expect(progressCallback.mock.calls[0]?.[0]).toMatchObject({
      total: 2,
      completed: 2,
      failed: 0,
      skipped: 0,
      currentStage: 'vectortile',
    });

    expect(afterRun).toHaveBeenCalledWith({ total: 2, completed: 2, failed: 0, skipped: 0 });
  });

  it('should pass StageControls to adapter and postprocess in the expected order', async () => {
    const tasks = [makeTask(0), makeTask(1), makeTask(2)];

    const calls: string[] = [];

    const adapter: VectorTileStageAdapter = {
      process: vi.fn(async (_tasks, onProgress, controls) => {
        // The orchestrator should supply defaults even if controls are omitted.
        expect(typeof controls?.waitIfPaused).toBe('function');
        expect(typeof controls?.getSignal).toBe('function');
        expect(typeof controls?.requestPause).toBe('function');

        // Simulate worker progress (incremental)
        onProgress({
          total: _tasks.length,
          completed: 1,
          failed: 0,
          skipped: 0,
          percentage: 0,
          currentStage: 'vectortile',
          currentTask: 'tile:0',
        });

        calls.push('adapter.process');
        return { processed: 2, failed: 1 };
      }),
    };

    const taskRegistry: RunVectorTileStageOrchestratorParams['taskRegistry'] = {
      registerTasks: vi.fn(async () => {
        calls.push('taskRegistry.registerTasks');
      }),
      resolveStageTasks: vi.fn(async () => ({
        runnableTasks: tasks,
        completedCount: 1,
        failedCount: 0,
        total: 3,
      })),
    };

    const postprocess = {
      persistPlaceholderMetadata: vi.fn(async () => {
        calls.push('postprocess.persistPlaceholderMetadata');
        return 0;
      }),
      syncVectorTilesToShapeStore: vi.fn(async () => {
        calls.push('postprocess.syncVectorTilesToShapeStore');
      }),
      summarizeVectorTilesByOrigin: vi.fn(async () => {
        calls.push('postprocess.summarizeVectorTilesByOrigin');
        return new Map();
      }),
      updateSourceMetadataStage: vi.fn(async () => {
        calls.push('postprocess.updateSourceMetadataStage');
      }),
      clearFeatureCache: vi.fn(() => {
        calls.push('postprocess.clearFeatureCache');
      }),
    };

    const progressCallback = vi.fn();
    const afterRun = vi.fn(async () => {});

    await runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      maxConcurrent: 2,
      // Plan A: omit controls to validate defaults
      progressCallback,
      postprocess,
      afterRun,
    });

    // registerTasks first
    expect(calls[0]).toBe('taskRegistry.registerTasks');

    // After adapter run: postprocess should persist -> sync -> summarize -> update -> clear
    expect(calls).toEqual([
      'taskRegistry.registerTasks',
      'adapter.process',
      'postprocess.persistPlaceholderMetadata',
      'postprocess.syncVectorTilesToShapeStore',
      'postprocess.summarizeVectorTilesByOrigin',
      'postprocess.updateSourceMetadataStage',
      'postprocess.clearFeatureCache',
    ]);

    // Progress callback should have been invoked, and totals should include baseCompleted (1)
    expect(progressCallback).toHaveBeenCalled();
    const firstProgress = progressCallback.mock.calls[0]?.[0];
    expect(firstProgress).toMatchObject({
      total: 3,
      currentStage: 'vectortile',
    });

    // processed(2) + baseCompleted(1) => completed 3; failed should be 0 because total is already filled
    expect(afterRun).toHaveBeenCalledWith({ total: 3, completed: 3, failed: 0, skipped: 0 });
  });
});
