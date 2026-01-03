import { describe, expect, it, vi } from 'vitest';

import { runTasksWithConcurrency } from './runTasksWithConcurrency.js';

describe('runTasksWithConcurrency', () => {
  it('runs tasks with requested concurrency and honors waitIfPaused', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => i);

    let inFlight = 0;
    let maxSeen = 0;

    const waitIfPaused = vi.fn(async () => {
      // no-op
    });

    const taskRunner = vi.fn(async (_t: number) => {
      inFlight += 1;
      maxSeen = Math.max(maxSeen, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
    });

    const r = await runTasksWithConcurrency({
      tasks,
      taskRunner,
      controls: {
        maxConcurrent: 3,
        waitIfPaused,
        getSignal: () => new AbortController().signal,
        requestPause: async () => {},
      },
    });

    expect(r).toEqual({ processed: 5, failed: 0 });
    expect(taskRunner).toHaveBeenCalledTimes(5);
    expect(waitIfPaused).toHaveBeenCalled();
    expect(maxSeen).toBeLessThanOrEqual(3);
  });
});

