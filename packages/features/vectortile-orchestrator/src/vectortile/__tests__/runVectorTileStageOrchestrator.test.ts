import { describe, expect, it, vi } from 'vitest';

import { runVectorTileStageOrchestrator } from '../runVectorTileStageOrchestrator.js';

import type { ProgressInfo } from '../../ports/sharedTypes.js';
import type { RunVectorTileStageOrchestratorParams } from '../orchestratorTypes.js';

import {
  makeAdapter,
  makeAfterRun,
  makeSummaryCapture,
  makeInputs,
  makePostprocess,
  makeTaskRegistry,
  makeTasks,
} from './helpers/fakes.js';

describe('vectortile orchestrator (stage-agnostic contract)', () => {
  it('when runnableTasks is empty, it should report base progress and skip adapter/postprocess', async () => {
    const tasks = makeTasks(2);
    const progressCallback = vi.fn();

    const afterOut = makeSummaryCapture();
    const afterRun = makeAfterRun(afterOut);

    const adapter = makeAdapter({ result: { processed: 0, failed: 0 } });
    const taskRegistry = makeTaskRegistry({ runnableTasks: [], completedCount: 2, failedCount: 0, total: 2 });
    const postprocess = makePostprocess();

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
      postprocess,
      afterRun,
    });

    expect(taskRegistry.registerTasks).toHaveBeenCalledTimes(1);
    expect(taskRegistry.resolveStageTasks).toHaveBeenCalledTimes(1);

    expect(adapter.process).not.toHaveBeenCalled();

    expect(postprocess.persistPlaceholderMetadata).not.toHaveBeenCalled();
    expect(postprocess.syncVectorTilesToShapeStore).not.toHaveBeenCalled();

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
    const tasks = makeTasks(3);
    const calls: string[] = [];

    const adapter = makeAdapter({
      onCall: ({ controlsDefined }) => {
        expect(controlsDefined).toBe(true);
        calls.push('adapter.process');
      },
      onProgress: (report, _tasks) => {
        report({
          total: _tasks.length,
          completed: 1,
          failed: 0,
          skipped: 0,
          percentage: 0,
          currentStage: 'vectortile',
          currentTask: 'tile:0',
        });
      },
      result: { processed: 2, failed: 1 },
    });

    const taskRegistry = makeTaskRegistry({ runnableTasks: tasks, completedCount: 1, failedCount: 0, total: 3 });
    (taskRegistry.registerTasks as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('taskRegistry.registerTasks');
    });

    const postprocess = makePostprocess(calls);

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

    expect(calls).toEqual([
      'taskRegistry.registerTasks',
      'adapter.process',
      'postprocess.persistPlaceholderMetadata',
      'postprocess.syncVectorTilesToShapeStore',
      'postprocess.summarizeVectorTilesByOrigin',
      'postprocess.updateSourceMetadataStage',
      'postprocess.clearFeatureCache',
    ]);

    expect(progressCallback).toHaveBeenCalled();
    expect(afterRun).toHaveBeenCalledWith({ total: 3, completed: 3, failed: 0, skipped: 0 });
  });

  it('should pass maxConcurrent through controls to adapter', async () => {
    const tasks = makeTasks(2);

    const adapter = makeAdapter({
      onCall: () => {},
      onProgress: (_report) => {
        // no-op
      },
      result: { processed: 2, failed: 0 },
    });

    // Intercept controls
    (adapter.process as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_tasks, _report, controls) => {
      expect(controls?.maxConcurrent).toBe(7);
      return { processed: _tasks.length, failed: 0 };
    });

    const taskRegistry = makeTaskRegistry({ runnableTasks: tasks, completedCount: 0, failedCount: 0, total: 2 });
    const postprocess = makePostprocess();

    await runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      maxConcurrent: 7,
      postprocess,
      afterRun: vi.fn(async () => {}),
    });
  });

  it('should cooperate with pause/resume via waitIfPaused (adapter awaits)', async () => {
    const tasks = makeTasks(1);
    const taskRegistry = makeTaskRegistry({ runnableTasks: tasks, total: 1 });
    const postprocess = makePostprocess();

    let paused = true;
    const waitIfPaused = vi.fn(async () => {
      while (paused) {
        await new Promise((r) => setTimeout(r, 1));
      }
    });

    const adapter = makeAdapter({ allowPause: true, result: { processed: 1, failed: 0 } });

    const promise = runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      waitIfPaused,
      getSignal: () => new AbortController().signal,
      postprocess,
      afterRun: vi.fn(async () => {}),
    });

    // let it spin
    await new Promise((r) => setTimeout(r, 5));
    expect(waitIfPaused).toHaveBeenCalled();

    paused = false;
    await promise;
  });

  it('should expose AbortSignal via controls to adapter', async () => {
    const tasks = makeTasks(1);
    const taskRegistry = makeTaskRegistry({ runnableTasks: tasks, total: 1 });
    const postprocess = makePostprocess();

    const controller = new AbortController();
    const getSignal = () => controller.signal;
    const adapter = makeAdapter({
      result: { processed: 1, failed: 0 },
    });

    (adapter.process as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_tasks, _report, controls) => {
      expect(controls?.getSignal()).toBe(controller.signal);
      return { processed: 1, failed: 0 };
    });

    await runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      getSignal,
      postprocess,
      afterRun: vi.fn(async () => {}),
    });
  });

  it('should aggregate progress with baseCompleted/baseFailed into progressCallback', async () => {
    const tasks = makeTasks(3);
    const taskRegistry = makeTaskRegistry({ runnableTasks: tasks, completedCount: 1, failedCount: 0, total: 3 });
    const postprocess = makePostprocess();

    const adapter = makeAdapter({
      onProgress: (report) => {
        report({
          total: 3,
          completed: 1,
          failed: 0,
          skipped: 0,
          percentage: 0,
          currentStage: 'processing',
          currentTask: 'tile:1',
        } satisfies ProgressInfo);
      },
      result: { processed: 2, failed: 0 },
    });

    const progressCallback = vi.fn();

    await runVectorTileStageOrchestrator({
      nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
      metadataEnabled: true,
      tasks,
      inputsByTaskId: makeInputs(tasks),
      taskRegistry,
      adapter,
      progressCallback,
      postprocess,
      afterRun: vi.fn(async () => {}),
    });

    const last = progressCallback.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({
      total: 3,
      completed: 2, // base(1) + adapter(1)
      failed: 0,
      currentStage: 'vectortile',
    });
  });
});
