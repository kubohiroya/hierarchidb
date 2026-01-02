import { describe, expect, it, vi } from 'vitest';
import { runStageTasks } from './runStageTasks.js';

describe('runStageTasks', () => {
  it('handles no runnable tasks', async () => {
    const progress = vi.fn();
    const resolveStageTasks = vi.fn(async () => ({
      runnableTasks: [],
      completedCount: 2,
      failedCount: 1,
      total: 3,
    }));

    const processRunnableTasks = vi.fn(async () => ({ processed: 0, failed: 0 }));

    const res = await runStageTasks({
      stage: 'extract1',
      tasks: [{}],
      resolveStageTasks,
      processRunnableTasks,
      progressCallback: progress,
      taskQueuedMessage: 'queued',
      alreadyCompletedMessage: 'already',
      completedMessage: 'done',
    });

    expect(processRunnableTasks).not.toHaveBeenCalled();
    expect(res.base).toEqual({ total: 3, completed: 2, failed: 1 });
    expect(progress).toHaveBeenCalled();
  });

  it('runs runnable tasks and emits completion', async () => {
    const progress = vi.fn();
    const resolveStageTasks = vi.fn(async () => ({
      runnableTasks: [{ id: 1 }],
      completedCount: 0,
      failedCount: 0,
      total: 1,
    }));

    const processRunnableTasks = vi.fn(async () => ({ processed: 1, failed: 0 }));

    const res = await runStageTasks({
      stage: 'extract2',
      tasks: [{ id: 1 }],
      resolveStageTasks,
      processRunnableTasks,
      progressCallback: progress,
      taskQueuedMessage: 'queued',
      alreadyCompletedMessage: 'already',
      completedMessage: 'done',
    });

    expect(processRunnableTasks).toHaveBeenCalledTimes(1);
    expect(res.result).toEqual({ processed: 1, failed: 0 });
    const last = progress.mock.calls.at(-1)?.[0];
    expect(last?.currentTask).toBe('done');
    expect(last?.completed).toBe(1);
  });

  it('uses default stage messages when not provided', async () => {
    const progress = vi.fn();

    await runStageTasks({
      stage: 'extract2',
      tasks: [{ id: 1 }],
      resolveStageTasks: async () => ({ runnableTasks: [], completedCount: 1, failedCount: 0, total: 1 }),
      processRunnableTasks: vi.fn(async () => ({ processed: 0, failed: 0 })),
      progressCallback: progress,
      // intentionally omit taskQueuedMessage/alreadyCompletedMessage/completedMessage
    });

    expect(progress).toHaveBeenCalled();
    const calls = progress.mock.calls.map(([arg]) => arg.currentTask);
    expect(calls).toContain('Extract2 tasks queued');
    expect(calls).toContain('Extract2 already completed');
  });
});
