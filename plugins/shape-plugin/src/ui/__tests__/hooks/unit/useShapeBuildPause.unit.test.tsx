import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildSessionLifecycleAtom } from '../../../atoms/buildSessionStateAtoms.js';
import { useShapeBuildPause } from '../../../components/build-progress/internal/useShapeBuildSessionControlActions/useShapeBuildPause.js';

const notifyErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@hierarchidb/components/notify', () => ({
  notify: {
    error: notifyErrorMock,
    warning: vi.fn(),
  },
}));

describe('useShapeBuildPause', () => {
  it('dispatches a typed shutdown timeout as criticalError', async () => {
    const store = createStore();
    const timeoutError = new Error('pipeline shutdown timed out');
    timeoutError.name = 'ShapeBuildPauseShutdownTimeoutError';
    const bridge = {
      initialize: vi.fn(async () => undefined),
      startBuildSession: vi.fn(),
      pauseBuildSession: vi.fn(async () => {
        throw timeoutError;
      }),
      cancelQueuedBuildSession: vi.fn(),
    };
    const setRequestedControlAction = vi.fn();
    const setIsStopRequested = vi.fn();
    const setIsStopAccepted = vi.fn();
    const clearStartPendingRef = { current: vi.fn() };
    const bridgeRef = { current: bridge };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const view = renderHook(
      () =>
        useShapeBuildPause({
          activeNodeId: 'node-pause-timeout' as NodeId,
          buildStatus: 'running',
          runtimeStatus: 'running',
          buildSessionTransitionActive: false,
          isStopRequestedInFlight: false,
          bridgeRef,
          clearStartPendingRef,
          setRequestedControlAction,
          setIsStopRequested,
          setIsStopAccepted,
          handleCancelQueued: vi.fn(async () => undefined),
        }),
      { wrapper }
    );

    await act(async () => {
      await view.result.current('user-pause');
    });

    const lifecycle = store.get(buildSessionLifecycleAtom);
    expect(lifecycle.phase).toBe('failed');
    expect(lifecycle.criticalError).toMatchObject({
      errorName: 'ShapeBuildPauseShutdownTimeoutError',
      contractViolation: false,
    });
    expect(setRequestedControlAction).toHaveBeenLastCalledWith('none');
    expect(setIsStopRequested).toHaveBeenLastCalledWith(false);
    expect(setIsStopAccepted).toHaveBeenLastCalledWith(false);
    expect(notifyErrorMock).toHaveBeenCalledWith(
      'Pause failed because the active pipeline could not be stopped safely.'
    );
  });
});
