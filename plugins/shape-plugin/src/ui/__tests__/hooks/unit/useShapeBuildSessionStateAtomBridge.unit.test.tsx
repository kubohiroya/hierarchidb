import type { NodeId } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
} from '../../../../common/types/session-events';
import {
  buildSessionLifecycleAtom,
  buildSessionSnapshotHandshakeReceivedAtom,
  dispatchBuildSessionEventAtom,
  stageTimingByStageAtom,
} from '../../../atoms/buildSessionStateAtoms';
import { useShapeBuildSessionStateAtomBridge } from '../../../components/build-progress/useShapeBuildSessionStateAtomBridge';

type BridgeCallbacks = {
  onSessionState: (event: SessionStatusUpdatedEvent) => void;
  onTaskEvent: (event: StageSnapshotUpdatedEvent) => void;
};

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  getBuildSessionRuntime: vi.fn(),
  subscribeAll: vi.fn(),
  unsubscribe: vi.fn(),
  callbacks: null as BridgeCallbacks | null,
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => ({
    initialize: mocks.initialize,
    getBuildSessionRuntime: mocks.getBuildSessionRuntime,
    subscribeAll: mocks.subscribeAll,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks = null;
  mocks.initialize.mockResolvedValue(undefined);
  mocks.getBuildSessionRuntime.mockResolvedValue(null);
  mocks.subscribeAll.mockImplementation(async (_nodeType, _nodeId, callbacks) => {
    mocks.callbacks = callbacks as BridgeCallbacks;
    return mocks.unsubscribe;
  });
});

const startBridge = async (store: ReturnType<typeof createStore>) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const view = renderHook(() => useShapeBuildSessionStateAtomBridge('node-1' as NodeId), {
    wrapper,
  });

  await waitFor(() => {
    expect(mocks.callbacks).not.toBeNull();
  });
  const callbacks = mocks.callbacks;
  if (!callbacks) {
    throw new Error('Bridge callbacks were not registered.');
  }
  return { callbacks, view };
};

const runningGeometryStatus: SessionStatusUpdatedEvent = {
  type: 'sessionStatusUpdated',
  payload: {
    nodeId: 'node-1' as NodeId,
    phase: 'running',
    isActive: true,
    startedAt: 1_000,
    stageId: 'geometry',
    stageStartedAt: 1_100,
    stageInactiveMs: 0,
  },
};

const runningSourceStatus: SessionStatusUpdatedEvent = {
  type: 'sessionStatusUpdated',
  payload: {
    nodeId: 'node-1' as NodeId,
    phase: 'running',
    isActive: true,
    startedAt: 1_000,
    stageId: 'source',
    stageStartedAt: 1_050,
    stageInactiveMs: 0,
  },
};

const emptyGeometrySnapshot: StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated',
  payload: {
    stageId: 'geometry',
    tasks: [],
    stageStartedAt: 1_100,
    stageInactiveMs: 0,
  },
};

const emptySourceSnapshot: StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated',
  payload: {
    stageId: 'source',
    tasks: [],
    stageStartedAt: 1_050,
    stageInactiveMs: 0,
  },
};

describe('useShapeBuildSessionStateAtomBridge', () => {
  it('keeps UI sync initializing until the authoritative stage snapshot arrives', async () => {
    const store = createStore();
    const { callbacks, view } = await startBridge(store);

    act(() => {
      callbacks.onSessionState(runningGeometryStatus);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(false);
    expect(store.get(stageTimingByStageAtom).geometry).toBeNull();

    act(() => {
      callbacks.onTaskEvent(emptyGeometrySnapshot);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(true);
    expect(store.get(stageTimingByStageAtom).geometry).toEqual({
      stageStartedAt: 1_100,
      stageInactiveMs: 0,
      stageCompletedAt: undefined,
    });

    view.unmount();
  });

  it('preserves completed UI sync when the stage snapshot arrives before session status', async () => {
    const store = createStore();
    const { callbacks, view } = await startBridge(store);

    act(() => {
      callbacks.onTaskEvent(emptyGeometrySnapshot);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('source');
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(true);

    act(() => {
      callbacks.onSessionState(runningGeometryStatus);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(true);
    expect(store.get(stageTimingByStageAtom).geometry).toEqual({
      stageStartedAt: 1_100,
      stageInactiveMs: 0,
      stageCompletedAt: undefined,
    });

    act(() => {
      callbacks.onTaskEvent(emptySourceSnapshot);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');

    view.unmount();
  });

  it('reapplies the canonical status selection after local view selection changes', async () => {
    const store = createStore();
    const { callbacks, view } = await startBridge(store);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'viewSelectionChanged',
      payload: { activeStageId: 'geometry' },
    });
    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');

    act(() => {
      callbacks.onSessionState(runningSourceStatus);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('source');

    view.unmount();
  });
});
