// @vitest-environment jsdom

import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type CanonicalBuildSessionSameRealmCommands,
  useCanonicalBuildSessionControls,
} from '../useCanonicalBuildSessionControls.js';

const NODE_ID = 'controls-node' as NodeId;

const createCommands = (): CanonicalBuildSessionSameRealmCommands => ({
  startBuildSession: vi.fn(async () => undefined),
  pauseBuildSession: vi.fn(async () => undefined),
  cancelQueuedBuildSession: vi.fn(async () => undefined),
});

describe('useCanonicalBuildSessionControls', () => {
  it('rejects start before subscription readiness and exposes the error', async () => {
    const commands = createCommands();
    const { result, rerender } = renderHook(
      ({ subscriptionReady }) =>
        useCanonicalBuildSessionControls({
          nodeId: NODE_ID,
          subscriptionReady,
          commandTransport: { kind: 'same-realm', commands },
        }),
      { initialProps: { subscriptionReady: false } }
    );

    expect(result.current.canStartBuildSession).toBe(false);
    await act(async () => {
      await expect(result.current.startBuildSession()).resolves.toBe(false);
    });
    expect(commands.startBuildSession).not.toHaveBeenCalled();
    expect(result.current.mutationError?.message).toMatch(/subscription is not ready/);

    rerender({ subscriptionReady: true });
    expect(result.current.canStartBuildSession).toBe(true);
    await act(async () => {
      await expect(result.current.startBuildSession()).resolves.toBe(true);
    });
    expect(commands.startBuildSession).toHaveBeenCalledWith(NODE_ID);
    expect(result.current.mutationError).toBeNull();
  });

  it('routes pause and queued cancel through the explicit command transport', async () => {
    const commands = createCommands();
    const { result } = renderHook(() =>
      useCanonicalBuildSessionControls({
        nodeId: NODE_ID,
        subscriptionReady: true,
        commandTransport: { kind: 'same-realm', commands },
      })
    );

    await act(async () => {
      await expect(result.current.pauseBuildSession('user-pause')).resolves.toBe(true);
    });
    await act(async () => {
      await expect(result.current.cancelQueuedBuildSession('user-cancel')).resolves.toBe(true);
    });

    expect(commands.pauseBuildSession).toHaveBeenCalledWith(NODE_ID, 'user-pause');
    expect(commands.cancelQueuedBuildSession).toHaveBeenCalledWith(NODE_ID, 'user-cancel');
  });

  it('keeps commands disabled until explicit command initialization succeeds', async () => {
    let completeInitialization: (() => void) | undefined;
    const initialization = new Promise<void>((resolve) => {
      completeInitialization = resolve;
    });
    const commands = createCommands();
    commands.initialize = vi.fn(async () => initialization);
    const { result } = renderHook(() =>
      useCanonicalBuildSessionControls({
        nodeId: NODE_ID,
        subscriptionReady: true,
        commandTransport: { kind: 'same-realm', commands },
      })
    );

    expect(result.current.canStartBuildSession).toBe(false);
    await act(async () => {
      await expect(result.current.startBuildSession()).resolves.toBe(false);
    });
    expect(commands.startBuildSession).not.toHaveBeenCalled();
    expect(result.current.mutationError?.message).toMatch(/command transport is not ready/);

    const resolveInitialization = completeInitialization;
    if (!resolveInitialization)
      throw new Error('Initialization completion callback is unavailable');
    act(() => resolveInitialization());
    await waitFor(() => expect(result.current.canStartBuildSession).toBe(true));
    await act(async () => {
      await expect(result.current.startBuildSession()).resolves.toBe(true);
    });
    expect(commands.startBuildSession).toHaveBeenCalledWith(NODE_ID);
  });

  it('keeps command rejection visible without synthesizing lifecycle state', async () => {
    const commands = createCommands();
    vi.mocked(commands.pauseBuildSession).mockRejectedValueOnce(new Error('pause rejected'));
    const { result } = renderHook(() =>
      useCanonicalBuildSessionControls({
        nodeId: NODE_ID,
        subscriptionReady: true,
        commandTransport: { kind: 'same-realm', commands },
      })
    );

    await act(async () => {
      await expect(result.current.pauseBuildSession()).resolves.toBe(false);
    });
    expect(result.current.mutationError?.message).toBe('pause rejected');
    expect(result.current.pendingCommand).toBeNull();
  });
});
