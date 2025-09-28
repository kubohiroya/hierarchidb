import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BatchProgressEvent } from '../../../shared/index.js';
import { useShapeProgress } from '../../hooks/useShapeProgress.js';

const apiRef: { current: any } = { current: null };

vi.mock('../../hooks/useShapeAPI.js', () => ({
  useShapeAPIGetter: () => async () => apiRef.current,
}));

describe('useShapeProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const unsubscribeSpy = vi.fn();
    apiRef.current = {
      subscribeToProgress: vi.fn((sessionId: string, cb: (event: BatchProgressEvent) => void) => {
        apiRef.current.__progressCallback = cb;
        return () => unsubscribeSpy();
      }),
      getBatchSession: vi.fn().mockResolvedValue(null),
      __unsubscribeSpy: unsubscribeSpy,
    };
  });

  const emit = (event: BatchProgressEvent) => {
    const cb = apiRef.current.__progressCallback as ((ev: BatchProgressEvent) => void) | undefined;
    if (!cb) throw new Error('progress callback not registered');
    act(() => {
      cb(event);
    });
  };

  it('updates progress and status from runtime worker events', async () => {
    const { result } = renderHook(() => useShapeProgress('session-1', { enablePollingFallback: false }));

    await waitFor(() => expect(apiRef.current.subscribeToProgress).toHaveBeenCalled());

    emit({
      sessionId: 'session-1',
      treeNodeId: 'tree-1' as any,
      stage: 'download',
      status: 'running',
      progress: 30,
      completedTasks: 3,
      totalTasks: 10,
      currentTask: 'task-3',
      timestamp: Date.now(),
      type: 'progress',
    });

    await waitFor(() => expect(result.current.progress?.completed).toBe(3));
    expect(result.current.progress).toMatchObject({
      total: 10,
      completed: 3,
      failed: 0,
      skipped: 7,
      percentage: 30,
      currentStage: 'download',
      currentTask: 'task-3',
    });
    expect(result.current.status).toMatchObject({
      status: 'processing',
      stage: 'download',
      progress: 30,
      hasErrors: false,
    });
    expect(result.current.error).toBeNull();
  });

  it('records errors from progress events', async () => {
    const { result } = renderHook(() => useShapeProgress('session-err', { enablePollingFallback: false }));
    await waitFor(() => expect(apiRef.current.subscribeToProgress).toHaveBeenCalled());

    emit({
      sessionId: 'session-err',
      treeNodeId: 'tree-err' as any,
      stage: 'simplify1',
      status: 'failed',
      progress: 45,
      completedTasks: 4,
      totalTasks: 10,
      currentTask: 'task-5',
      timestamp: Date.now(),
      type: 'error',
      error: 'download failed',
    });

    await waitFor(() => expect(result.current.status?.status).toBe('failed'));
    expect(result.current.status).toMatchObject({
      status: 'failed',
      hasErrors: true,
      error: 'download failed',
    });
    expect(result.current.progress?.failed).toBeGreaterThan(0);
  });

  it('unsubscribes from runtime updates', async () => {
    const { result, unmount } = renderHook(() => useShapeProgress('session-unsub', { enablePollingFallback: false }));
    await waitFor(() => expect(apiRef.current.subscribeToProgress).toHaveBeenCalled());

    act(() => {
      result.current.unsubscribe();
    });

    expect(apiRef.current.__unsubscribeSpy).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);

    unmount();
  });
});
