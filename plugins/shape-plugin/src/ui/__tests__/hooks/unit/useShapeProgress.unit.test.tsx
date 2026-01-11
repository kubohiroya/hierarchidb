import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BatchProgressEvent } from '@hierarchidb/runtime-shared-batch-processor';
import { useBuildProgress } from '../../../hooks/useBuildProgress.js';

const unsubscribeSpy = vi.fn();
let progressCallback: ((event: BatchProgressEvent) => void) | undefined;

const bridgeMock = {
  initialize: vi.fn(),
  subscribeBatchProgress: vi.fn(),
  getBatchSessionStatus: vi.fn(),
};

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getWorkerBridge: () => bridgeMock,
}));

const shouldRunUiHookTests = Boolean(process.env.ENABLE_SHAPE_UI_TESTS);
const describeUiProgress = shouldRunUiHookTests ? describe : describe.skip;

describeUiProgress('useShapeProgress', () => {
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
        taskType: 'download',
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

  it('updates progress and status from runtime-worker worker events', async () => {
    const { result } = renderHook(() => useBuildProgress('session-1', {
      autoSubscribe: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    await emit({
      sessionId: 'session-1',
      nodeId: 'console-1' as any,
      stage: 'download',
      phase: 'running',
      timestamp: Date.now(),
      payload: {
        total: 10,
        completed: 3,
        failed: 0,
      },
    });

    await waitFor(() => expect(result.current.progress?.completed).toBe(3));
    expect(result.current.progress).toMatchObject({
      total: 10,
      completed: 3,
      failed: 0,
      skipped: 0,
      percentage: 30,
      taskType: 'download',
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
    const { result } = renderHook(() => useBuildProgress('session-err', {
      autoSubscribe: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    await emit({
      sessionId: 'session-err',
      nodeId: 'console-err' as any,
      stage: 'extract1',
      phase: 'failed',
      timestamp: Date.now(),
      payload: {
        total: 10,
        completed: 4,
        failed: 1,
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

  it('unsubscribes from runtime-worker updates', async () => {
    const { result, unmount } = renderHook(() => useBuildProgress('session-unsub', {
      autoSubscribe: false,
    }));

    await act(async () => {
      await result.current.subscribe();
    });

    act(() => {
      result.current.unsubscribe();
    });

    expect(unsubscribeSpy).toHaveBeenCalled();
    unmount();
  });
});

if (!shouldRunUiHookTests) {
  describe.skip('useShapeProgress (UI tests disabled)', () => {});
}
