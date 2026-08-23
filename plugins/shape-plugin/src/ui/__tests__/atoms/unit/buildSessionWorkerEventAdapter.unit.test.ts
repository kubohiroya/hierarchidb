import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import type {
  AdapterHeartbeatEvent,
  AdapterSessionStatusUpdatedEvent,
  AdapterStageSnapshotUpdatedEvent,
  AdapterTaskProgressUpdatedEvent,
} from '@hierarchidb/ui-build-sessions';
import { createStore } from 'jotai/vanilla';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildSessionLifecycleAtom,
  buildSessionStageCountersAtom,
  buildSessionStageProgressAtom,
  buildSessionTaskStreamConnectedAtom,
  dispatchBuildSessionEventAtom,
  stageTimingByStageAtom,
} from '../../../atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '../../../atoms/buildSessionWorkerEventAdapterConstantsUtils';

describe('buildSessionWorkerEventAdapter', () => {
  const store = createStore();
  const dispatch = (event: Parameters<typeof store.set>[1]) => {
    store.set(dispatchBuildSessionEventAtom, event as never);
  };

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('maps runtime pub/sub event to sessionStatusUpdated', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const runtimeRecord: BuildSessionRuntimeRecord = {
      nodeType: 'shape',
      nodeId: 'node-1',
      status: 'running',
      isActive: true,
      revision: 3,
      startedAt: 10,
      updatedAt: 20,
      lastHeartbeatAt: 30,
    };

    adapter.onRuntimeRecord(runtimeRecord);

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.isActive).toBe(true);
    expect(runtime.heartbeatAt).toBeUndefined(); // heartbeatAt comes from onHeartbeat, not onRuntimeRecord
    expect(runtime.startedAt).toBe(10);
  });

  it('maps a paused runtime record and its persisted endpoint atomically', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const runtimeRecord: BuildSessionRuntimeRecord = {
      nodeType: 'shape',
      nodeId: 'node-1',
      status: 'paused',
      isActive: false,
      revision: 4,
      startedAt: 10,
      updatedAt: 40,
      lastHeartbeatAt: 30,
    };

    adapter.onRuntimeRecord(runtimeRecord);

    expect(store.get(buildSessionLifecycleAtom)).toMatchObject({
      phase: 'paused',
      isActive: false,
      startedAt: 10,
      heartbeatAt: 30,
    });
  });

  it('maps task pub/sub snapshot to stage counters', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);

    const snapshotEvent: AdapterStageSnapshotUpdatedEvent = {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [
          {
            taskId: 's-1',
            version: 1,
            stage: 'source',
            status: 'queued',
            progress: 0,
          },
        ],
        stageStartedAt: 1,
        stageInactiveMs: 0,
      },
    };
    adapter.onTaskEvent(snapshotEvent);

    const counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.queued).toBe(1);
  });

  it('replaces tasks on second snapshot (full snapshot semantics)', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);

    adapter.onTaskEvent({
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [
          { taskId: 's-1', version: 1, stage: 'source', status: 'queued', progress: 0 },
          { taskId: 's-2', version: 1, stage: 'source', status: 'running', progress: 10 },
        ],
        stageStartedAt: 1,
        stageInactiveMs: 0,
      },
    });
    expect(store.get(buildSessionStageCountersAtom).source.total).toBe(2);

    // Second snapshot replaces entirely
    adapter.onTaskEvent({
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [{ taskId: 's-1', version: 2, stage: 'source', status: 'completed', progress: 100 }],
        stageStartedAt: 1,
        stageInactiveMs: 0,
      },
    });

    const counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.terminal).toBe(1);
    expect(counters.running).toBe(0);
  });

  it('maps progress pub/sub event to taskProgressUpdated and updates stage progress', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const progressEvent: AdapterTaskProgressUpdatedEvent = {
      type: 'taskProgressUpdated',
      payload: {
        stageId: 'geometry',
        value: 42,
        message: 'geometry running',
      },
    };

    adapter.onProgressEvent(progressEvent);

    const progress = store.get(buildSessionStageProgressAtom);
    expect(progress.geometry).toBe(42);
  });

  it('maps onSessionState to sessionStatusUpdated with stopReason', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const sessionEvent: AdapterSessionStatusUpdatedEvent = {
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: 'node-1',
        phase: 'running',
        isActive: true,
        startedAt: 10,
        stopReason: 'route-leave',
      },
    };
    adapter.onSessionState(sessionEvent);

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.startedAt).toBe(10);
    expect(runtime.stopReason).toBe('route-leave');
  });

  it('stores stage timing from stageSnapshotUpdated via onTaskEvent', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onTaskEvent({
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'geometry',
        tasks: [{ taskId: 's-1', version: 50, stage: 'geometry', status: 'running', progress: 10 }],
        stageStartedAt: 50,
        stageInactiveMs: 0,
      },
    });

    const timing = store.get(stageTimingByStageAtom);
    expect(timing.geometry).not.toBeNull();
    expect(timing.geometry?.stageInactiveMs).toBe(0);
  });

  it('rejects invalid stage snapshot timing at the adapter boundary', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const baseEvent: AdapterStageSnapshotUpdatedEvent = {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'geometry',
        tasks: [],
        stageStartedAt: 1_000,
        stageInactiveMs: 100,
      },
    };
    expect(() =>
      adapter.onTaskEvent({
        ...baseEvent,
        payload: { ...baseEvent.payload, stageStartedAt: Number.NaN },
      })
    ).toThrowError('stageStartedAt must be a finite number');
    expect(() =>
      adapter.onTaskEvent({
        ...baseEvent,
        payload: { ...baseEvent.payload, stageInactiveMs: -1 },
      })
    ).toThrowError('stageInactiveMs must be non-negative');
    expect(() =>
      adapter.onTaskEvent({
        ...baseEvent,
        payload: { ...baseEvent.payload, stageCompletedAt: 1_050 },
      })
    ).toThrowError('stage duration must be finite and non-negative');
    expect(() =>
      adapter.onTaskEvent({
        ...baseEvent,
        payload: {
          ...baseEvent.payload,
          stageStartedAt: undefined,
        },
      } as unknown as AdapterStageSnapshotUpdatedEvent)
    ).toThrowError('stageStartedAt must be a finite number');
  });

  it('rejects session timing that is incomplete for its lifecycle phase', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'paused',
          isActive: false,
          startedAt: 1_000,
        },
      })
    ).toThrowError('pausedAt is required for phase paused');
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'running',
          isActive: true,
          startedAt: 1_000,
          pausedAt: 1_500,
        },
      })
    ).toThrowError('pausedAt must be absent for phase running');
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'running',
          isActive: true,
        },
      })
    ).toThrowError('startedAt is required for phase running');
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'completed',
          isActive: false,
          startedAt: 1_000,
        },
      })
    ).toThrowError('completedAt is required for phase completed');
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'completed',
          isActive: false,
          startedAt: 1_000,
          inactiveMs: 100,
          completedAt: 1_050,
        },
      })
    ).toThrowError('session duration must be finite and non-negative');
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'running',
          isActive: true,
          startedAt: 1_000,
          stageId: 'source',
        },
      })
    ).toThrowError('stageStartedAt must be a finite number');
  });

  it('throws when sessionRecord stopReason is outside ShapeBuildStopReason', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    expect(() => {
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'running',
          isActive: true,
          startedAt: 10,
          stopReason: 'invalid-stop-reason',
        },
      });
    }).toThrowError(
      '[shape buildSessionWorkerEventAdapter] unsupported stopReason: invalid-stop-reason'
    );
  });

  it('maps connection and heartbeat events', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onTaskStreamConnectionChanged(true);
    const heartbeatEvent: AdapterHeartbeatEvent = {
      type: 'heartbeat',
      payload: { nodeId: 'node-1', heartbeatAt: 55 },
    };
    adapter.onHeartbeat(heartbeatEvent);

    expect(store.get(buildSessionTaskStreamConnectedAtom)).toBe(true);
    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.heartbeatAt).toBe(55);
    // heartbeat does not change phase; phase remains idle
    expect(runtime.phase).toBe('idle');
  });

  it('maps onSessionState with status queued to phase queued (isActive=true)', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onSessionState({
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: 'node-1',
        phase: 'queued',
        isActive: true,
        startedAt: 100,
      },
    });

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('queued');
    expect(runtime.isActive).toBe(true);
    expect(runtime.startedAt).toBe(100);
  });

  it('allows starting before a session start timestamp has been recorded', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    expect(() =>
      adapter.onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: 'node-1',
          phase: 'starting',
          isActive: true,
        },
      })
    ).not.toThrow();
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('starting');
  });
});
