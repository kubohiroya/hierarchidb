import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BatchProgressEvent } from '@hierarchidb/runtime-shared-batch-processor';
import { useShapeProgress } from '../../hooks/useShapeProgress.js';

const unsubscribeSpy = vi.fn();
let progressCallback: ((event: BatchProgressEvent) => void) | undefined;

const bridgeMock = {
  initialize: vi.fn(),
  subscribeBatchProgress: vi.fn(),
  getBatchSessionStatus: vi.fn(),
};

vi.mock('@hierarchidb/runtime-ui-plugin-dialog', () => ({
  getWorkerBridge: () => bridgeMock,
}));

describe('useShapeProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressCallback = undefined;
    unsubscribeSpy.mockClear();
    unsubscribeSpy.mockImplementation(() => {
    });
    bridgeMock.initialize.mockResolvedValue(undefined);
    bridgeMock.getBatchSessionStatus.mockImplementation(async (_nodeType: string, session: string) => ({
      sessionId: session,
      nodeId: `${session}-node` as any,
      status: 'running',
      progress: {
        total: 10,
        completed: 3,
        failed: 0,
        percentage: 30,
        currentStage: 'download',
        currentTask: 'task-3',
      },
      startedAt: Date.now(),
      lastActivity: Date.now(),
    }));
    bridgeMock.subscribeBatchProgress.mockImplementation(
      async (_nodeType: string, _sessionId: string, cb: (event: BatchProgressEvent) => void) => {
        progressCallback = cb;
        return () => unsubscribeSpy();
      },
    );
  });

const emit = async (event: BatchProgressEvent) => {
  const cb = progressCallback;
  if (!cb) throw new Error('progress callback not registered');
  await act(async () => {
    cb(event);
  });
};

  it('updates progress and status from runtime worker events', async () => {
    const { result } = renderHook(() => useShapeProgress('session-1', {
      autoSubscribe: false,
      enablePollingFallback: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    await emit({
      sessionId: 'session-1',
      nodeId: 'tree-1' as any,
      stage: 'download',
      phase: 'running',
      timestamp: Date.now(),
      payload: {
        total: 10,
        completed: 3,
        failed: 0,
        currentTask: 'task-3',
      },
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
    const { result } = renderHook(() => useShapeProgress('session-err', {
      autoSubscribe: false,
      enablePollingFallback: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    await emit({
      sessionId: 'session-err',
      nodeId: 'tree-err' as any,
      stage: 'simplify1',
      phase: 'failed',
      timestamp: Date.now(),
      payload: {
        total: 10,
        completed: 4,
        failed: 1,
        currentTask: 'task-5',
      },
      error: { detail: 'download failed' },
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
    const { result, unmount } = renderHook(() => useShapeProgress('session-unsub', {
      autoSubscribe: false,
      enablePollingFallback: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    act(() => {
      result.current.unsubscribe();
    });

    expect(unsubscribeSpy).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);

    unmount();
  });
});
