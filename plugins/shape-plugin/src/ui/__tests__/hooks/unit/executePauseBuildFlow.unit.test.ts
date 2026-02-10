import { describe, expect, it, vi } from 'vitest';
import { executePauseBuildFlow } from '@hierarchidb/components';

describe('executePauseBuildFlow', () => {
  it('keeps pending true until pause and persist both complete', async () => {
    const events: string[] = [];
    let resolvePause: (() => void) | null = null;
    let resolvePersist: (() => void) | null = null;
    const pausePromise = new Promise<void>((resolve) => {
      resolvePause = resolve;
    });
    const persistPromise = new Promise<void>((resolve) => {
      resolvePersist = resolve;
    });

    const run = executePauseBuildFlow({
      reason: 'user-pause',
      onPendingChange: (pending) => {
        events.push(`pending:${String(pending)}`);
      },
      pauseSession: async (reason) => {
        events.push(`pause:${reason}`);
        await pausePromise;
      },
      persistPausedStatus: async (reason) => {
        events.push(`persist:${reason}`);
        await persistPromise;
      },
      onError: () => {
        events.push('error');
      },
    });

    await Promise.resolve();
    expect(events).toEqual(['pending:true', 'pause:user-pause']);

    resolvePause?.();
    await vi.waitFor(() => {
      expect(events).toContain('persist:user-pause');
    });

    resolvePersist?.();
    await run;
    expect(events).toEqual(['pending:true', 'pause:user-pause', 'persist:user-pause', 'pending:false']);
  });

  it('clears pending and reports error when pause fails', async () => {
    const onError = vi.fn();
    const persistPausedStatus = vi.fn();
    const onPendingChange = vi.fn();
    const error = new Error('pause failed');

    await executePauseBuildFlow({
      reason: 'user-pause',
      onPendingChange,
      pauseSession: async () => {
        throw error;
      },
      persistPausedStatus,
      onError,
    });

    expect(persistPausedStatus).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('clears pending and reports error when persist fails', async () => {
    const onError = vi.fn();
    const onPendingChange = vi.fn();
    const error = new Error('persist failed');

    await executePauseBuildFlow({
      reason: 'route-leave',
      onPendingChange,
      pauseSession: async () => {},
      persistPausedStatus: async () => {
        throw error;
      },
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
  });
});
