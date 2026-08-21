import type { TaskProgressUpdatedEvent, WorkerLogEvent } from '@hierarchidb/build-api';
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
  buildSessionTasksByStageAtom,
  completeBuildSessionRecoveryAtom,
  dispatchBuildSessionEventAtom,
  stageTimingByStageAtom,
} from '../../../atoms/buildSessionStateAtoms';
import { useShapeBuildSessionStateAtomBridge } from '../../../hooks/useShapeBuildSessionStateAtomBridge';

type BridgeCallbacks = {
  onSessionState: (event: SessionStatusUpdatedEvent) => void;
  onTaskEvent: (event: StageSnapshotUpdatedEvent) => void;
  onProgressEvent: (event: TaskProgressUpdatedEvent) => void;
};

type WorkerLogCallback = (event: WorkerLogEvent) => void;

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  getBuildSessionRuntime: vi.fn(),
  subscribeAll: vi.fn(),
  subscribeWorkerLog: vi.fn(),
  probeBuildSession: vi.fn(),
  unsubscribeCanonical: vi.fn(),
  unsubscribeWorkerLog: vi.fn(),
  callbacks: null as BridgeCallbacks | null,
  workerLogCallback: null as WorkerLogCallback | null,
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => ({
    initialize: mocks.initialize,
    getBuildSessionRuntime: mocks.getBuildSessionRuntime,
    subscribeAll: mocks.subscribeAll,
    subscribeWorkerLog: mocks.subscribeWorkerLog,
    getShapeQueryAPI: async () => ({ probeBuildSession: mocks.probeBuildSession }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks = null;
  mocks.workerLogCallback = null;
  mocks.initialize.mockResolvedValue(undefined);
  mocks.getBuildSessionRuntime.mockResolvedValue(null);
  mocks.probeBuildSession.mockResolvedValue({ kind: 'available' });
  mocks.subscribeAll.mockImplementation(async (_nodeType, _nodeId, callbacks) => {
    mocks.callbacks = callbacks as BridgeCallbacks;
    return mocks.unsubscribeCanonical;
  });
  mocks.subscribeWorkerLog.mockImplementation(async (_nodeType, _nodeId, callback) => {
    mocks.workerLogCallback = callback as WorkerLogCallback;
    return mocks.unsubscribeWorkerLog;
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
    expect(mocks.workerLogCallback).not.toBeNull();
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

const completedGeometrySnapshot: StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated',
  payload: {
    stageId: 'geometry',
    tasks: [
      {
        taskId: 'geometry-task-1',
        version: 3,
        stage: 'geometry',
        status: 'completed',
        progress: 100,
      },
    ],
    stageStartedAt: 1_100,
    stageInactiveMs: 0,
    stageCompletedAt: 1_300,
  },
};

const staleSourceSnapshot: StageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated',
  payload: {
    stageId: 'source',
    tasks: [
      {
        taskId: 'source-task-1',
        version: 1,
        stage: 'source',
        status: 'queued',
        progress: 0,
      },
    ],
    stageStartedAt: 1_050,
    stageInactiveMs: 0,
  },
};

describe('useShapeBuildSessionStateAtomBridge', () => {
  it('maps a recoverable probe result to criticalError and restarts after recovery completion', async () => {
    const recovery = {
      code: 'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const,
      recoverable: true as const,
      nodeId: 'node-1' as NodeId,
      table: 'buildStageStatuses' as const,
      field: 'inactiveMs' as const,
      fieldPath: 'buildStageStatuses.inactiveMs' as const,
      stageStatusId: 'node-1:source',
      stage: 'source' as const,
      received: 'undefined' as const,
      message: 'inactiveMs is missing',
    };
    mocks.probeBuildSession
      .mockResolvedValueOnce({ kind: 'recoverable-contract-error', error: recovery })
      .mockResolvedValueOnce({ kind: 'missing' });
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const view = renderHook(() => useShapeBuildSessionStateAtomBridge('node-1' as NodeId), {
      wrapper,
    });

    await waitFor(() => {
      expect(store.get(buildSessionLifecycleAtom).criticalError?.recovery).toEqual(recovery);
    });
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('failed');
    expect(mocks.getBuildSessionRuntime).not.toHaveBeenCalled();
    expect(mocks.subscribeAll).not.toHaveBeenCalled();

    act(() => {
      store.set(completeBuildSessionRecoveryAtom);
    });

    await waitFor(() => {
      expect(mocks.probeBuildSession).toHaveBeenCalledTimes(2);
      expect(mocks.subscribeAll).toHaveBeenCalledTimes(1);
    });
    expect(store.get(buildSessionLifecycleAtom).criticalError).toBeUndefined();
    view.unmount();
  });

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

  it('subscribes Worker diagnostics separately from canonical state and releases both streams', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const store = createStore();
      const { view } = await startBridge(store);
      const workerLogCallback = mocks.workerLogCallback;
      if (!workerLogCallback) {
        throw new Error('Worker log callback was not registered.');
      }

      act(() => {
        workerLogCallback({
          nodeId: 'node-1' as NodeId,
          timestamp: 1_200,
          level: 'error',
          message: 'snapshot failed',
          data: { stage: 'source' },
        });
      });

      expect(mocks.subscribeWorkerLog).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[Worker]', 'snapshot failed', { stage: 'source' });

      view.unmount();
      expect(mocks.unsubscribeWorkerLog).toHaveBeenCalledTimes(1);
      expect(mocks.unsubscribeCanonical).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
      consoleLog.mockRestore();
    }
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

  it('disposes a subscription that resolves after the bridge was cancelled', async () => {
    let resolveSubscription: ((unsubscribe: () => void) => void) | null = null;
    mocks.subscribeAll.mockImplementationOnce(async (_nodeType, _nodeId, callbacks) => {
      mocks.callbacks = callbacks as BridgeCallbacks;
      return new Promise<() => void>((resolve) => {
        resolveSubscription = resolve;
      });
    });
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const view = renderHook(() => useShapeBuildSessionStateAtomBridge('node-1' as NodeId), {
      wrapper,
    });

    await waitFor(() => {
      expect(resolveSubscription).not.toBeNull();
    });
    view.unmount();
    expect(mocks.unsubscribeCanonical).not.toHaveBeenCalled();
    expect(mocks.subscribeWorkerLog).not.toHaveBeenCalled();

    const resolvePendingSubscription = resolveSubscription;
    if (!resolvePendingSubscription) {
      throw new Error('Subscription resolver was not registered.');
    }
    resolvePendingSubscription(mocks.unsubscribeCanonical);

    await waitFor(() => {
      expect(mocks.unsubscribeCanonical).toHaveBeenCalledTimes(1);
    });
    expect(mocks.subscribeWorkerLog).not.toHaveBeenCalled();
  });

  it('re-subscribes after cancellation and ignores events from the cancelled subscription', async () => {
    const store = createStore();
    const first = await startBridge(store);
    const cancelledCallbacks = first.callbacks;

    first.view.unmount();
    expect(mocks.unsubscribeCanonical).toHaveBeenCalledTimes(1);
    expect(mocks.unsubscribeWorkerLog).toHaveBeenCalledTimes(1);

    const second = await startBridge(store);
    expect(mocks.subscribeAll).toHaveBeenCalledTimes(2);
    expect(mocks.subscribeWorkerLog).toHaveBeenCalledTimes(2);

    act(() => {
      second.callbacks.onSessionState(runningGeometryStatus);
      second.callbacks.onTaskEvent(completedGeometrySnapshot);
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
    expect(store.get(buildSessionTasksByStageAtom).geometry).toEqual([
      expect.objectContaining({
        taskId: 'geometry-task-1',
        status: 'completed',
        progress: 100,
      }),
    ]);

    act(() => {
      cancelledCallbacks.onSessionState(runningSourceStatus);
      cancelledCallbacks.onTaskEvent(staleSourceSnapshot);
      cancelledCallbacks.onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'source-task-1',
          version: 1,
          stageId: 'source',
          value: 0,
        },
      });
    });

    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
    expect(store.get(buildSessionTasksByStageAtom).source).toEqual([]);
    expect(store.get(buildSessionTasksByStageAtom).geometry[0]).toEqual(
      expect.objectContaining({ status: 'completed', progress: 100 })
    );

    second.view.unmount();
    expect(mocks.unsubscribeCanonical).toHaveBeenCalledTimes(2);
    expect(mocks.unsubscribeWorkerLog).toHaveBeenCalledTimes(2);
  });
});
