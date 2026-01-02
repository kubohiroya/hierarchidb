import { describe, expect, it, vi } from 'vitest';
import { runDownloadTasks } from './runDownloadTasks.js';

describe('runDownloadTasks', () => {
  it('returns base counts when nothing is runnable', async () => {
    const progress = vi.fn();
    const res = await runDownloadTasks({
      nodeId: 'n1' as any,
      tasks: [{ id: 1 }],
      inputsByTaskId: new Map(),
      resolveStageTasks: async () => ({ runnableTasks: [], completedCount: 1, failedCount: 0, total: 1 }),
      process: vi.fn(async () => ({ processed: 0, failed: 0 })),
      progressCallback: progress,
    });

    expect(res).toEqual({ total: 1, completed: 1, failed: 0 });
    expect(progress).toHaveBeenCalled();
  });

  it('processes runnable tasks and returns updated counts', async () => {
    const progress = vi.fn();
    const process = vi.fn(async () => ({ processed: 2, failed: 1 }));

    const res = await runDownloadTasks({
      nodeId: 'n1' as any,
      tasks: [{ id: 1 }],
      inputsByTaskId: new Map([['t', { a: 1 }]]),
      resolveStageTasks: async () => ({ runnableTasks: [{ id: 1 }], completedCount: 0, failedCount: 0, total: 3 }),
      process,
      progressCallback: progress,
    });

    expect(process).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ total: 3, completed: 2, failed: 1 });
  });
});

