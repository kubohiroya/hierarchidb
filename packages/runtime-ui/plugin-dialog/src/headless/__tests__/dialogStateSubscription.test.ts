import { describe, expect, it, vi } from 'vitest';
import type { DialogStateSubscribeInput, MultiStepDialogState, NodeId } from '@hierarchidb/common-type';
import { subscribeDialogState } from '../usePluginDialogController.js';

type SnapshotFactoryOptions = {
  nodeId?: NodeId;
  activeStepIndex?: number;
};

const createSnapshot = (options: SnapshotFactoryOptions = {}): MultiStepDialogState => ({
  nodeId: options.nodeId ?? ('node-1' as NodeId),
  activeStepIndex: options.activeStepIndex ?? 0,
  steps: [],
  canProceedNext: false,
  canGoBack: false,
  canSave: false,
  canStartBatch: false,
  updatedAt: Date.now(),
});

describe('subscribeDialogState', () => {
  const params: DialogStateSubscribeInput = {
    nodeType: 'folder-plugin',
    nodeId: 'node-1' as NodeId,
  };

  it('throws when subscribeState/unsubscribeState are missing', async () => {
    const getState = vi.fn();
    const warn = vi.fn();

    await expect(
      subscribeDialogState({
        api: { getState } as any,
        params,
        onSnapshot: vi.fn(),
        logger: { warn },
      }),
    ).rejects.toThrow('DialogStateAPI must implement subscribeState/unsubscribeState');

    expect(warn).toHaveBeenCalled();
    expect(getState).not.toHaveBeenCalled();
  });

  it('subscribes/unsubscribes and hydrates the initial snapshot', async () => {
    const snapshot = createSnapshot();
    const subscribeState = vi.fn().mockImplementation(async (_input, callback: any) => {
      callback(snapshot);
      return 'sub-1';
    });
    const unsubscribeState = vi.fn().mockResolvedValue(undefined);
    const getState = vi.fn().mockResolvedValue(snapshot);
    const release = vi.fn();
    const onSnapshot = vi.fn();

    const cleanup = await subscribeDialogState({
      api: { subscribeState, unsubscribeState, getState } as any,
      params,
      onSnapshot,
      deps: {
        createCallback: handler => handler,
        releaseCallback: release,
      },
    });

    expect(subscribeState).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith(snapshot);

    cleanup();

    expect(unsubscribeState).toHaveBeenCalledWith('sub-1');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('propagates subscribeState failures', async () => {
    const subscribeState = vi.fn().mockRejectedValue(new Error('subscribe failed'));
    const unsubscribeState = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn();
    const warn = vi.fn();

    await expect(
      subscribeDialogState({
        api: { subscribeState, unsubscribeState } as any,
        params,
        onSnapshot: vi.fn(),
        logger: { warn },
        deps: {
          createCallback: handler => handler,
          releaseCallback: release,
        },
      }),
    ).rejects.toThrow('subscribe failed');

    expect(warn).toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('throws when DialogStateAPI is not provided', async () => {
    await expect(
      subscribeDialogState({
        api: null,
        params,
        onSnapshot: vi.fn(),
      }),
    ).rejects.toThrow('DialogStateAPI unavailable; cannot subscribe');
  });
});
