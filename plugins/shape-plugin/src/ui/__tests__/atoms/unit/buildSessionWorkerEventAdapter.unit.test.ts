import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';
import type { BuildProgressEvent, BuildSessionRuntimeRecord, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import {
  buildSessionRuntimeAtom,
  buildSessionStageCountersAtom,
  buildSessionStageProgressAtom,
  buildSessionTaskStreamConnectedAtom,
  dispatchBuildSessionEventAtom,
} from '../../../atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '../../../atoms/buildSessionWorkerEventAdapter';

describe('buildSessionWorkerEventAdapter', () => {
  const store = createStore();
  const dispatch = (event: Parameters<typeof store.set>[1]) => {
    store.set(dispatchBuildSessionEventAtom, event as never);
  };

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('maps runtime pub/sub event to runtimeSnapshotReceived', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const runtimeRecord: BuildSessionRuntimeRecord = {
      nodeId: 'node-1',
      status: 'running',
      isActive: true,
      revision: 3,
      startedAt: 10,
      updatedAt: 20,
      lastHeartbeatAt: 30,
    };

    adapter.onRuntimeRecord(runtimeRecord);

    const runtime = store.get(buildSessionRuntimeAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.isActive).toBe(true);
    expect(runtime.heartbeatAt).toBe(30);
  });

  it('maps task pub/sub snapshot/update to task events and counters', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);

    const snapshotEvent: BuildTaskUpdateEvent = {
      type: 'snapshot',
      nodeId: 'node-1',
      tasks: [
        {
          taskId: 's-1',
          version: 1,
          stage: 'source',
          status: 'queued',
          progress: 0,
        },
      ],
    };
    adapter.onTaskEvent(snapshotEvent);

    let counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.queued).toBe(1);

    const updateEvent: BuildTaskUpdateEvent = {
      type: 'update',
      nodeId: 'node-1',
      task: {
        taskId: 's-1',
        version: 4,
        stage: 'source',
        status: 'completed',
        progress: 100,
      },
    };
    adapter.onTaskEvent(updateEvent);

    counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.queued).toBe(0);
    expect(counters.terminal).toBe(1);
  });

  it('maps progress pub/sub event to progressReceived and updates stage progress', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const progressEvent: BuildProgressEvent = {
      nodeId: 'node-1',
      stage: 'geometry',
      phase: 'running',
      timestamp: Date.now(),
      payload: {
        percentage: 42,
        total: 10,
        completed: 4,
      },
      message: 'geometry running',
    };

    adapter.onProgressEvent(progressEvent);

    const progress = store.get(buildSessionStageProgressAtom);
    expect(progress.geometry).toBe(42);
  });

  it('throws when progress payload.percentage is missing', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const progressEvent: BuildProgressEvent = {
      nodeId: 'node-1',
      stage: 'geometry',
      phase: 'running',
      timestamp: Date.now(),
      payload: {
        total: 10,
        completed: 4,
      },
      message: 'geometry running',
    };

    expect(() => {
      adapter.onProgressEvent(progressEvent);
    }).toThrowError('[shape buildSessionWorkerEventAdapter] progress payload.percentage must be a finite number, received undefined');
  });

  it('maps session record pub/sub event to runtime timing fields', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onSessionState({
      nodeId: 'node-1',
      sessionRecord: {
        status: 'running',
        startedAt: 10,
        stageHeartbeatAt: 90,
        completedAt: undefined,
        stageId: 'geometry',
        stopReason: 'route-leave',
        inactiveMs: 44,
        stageStartedAt: 50,
        stageInactiveMs: 6,
      },
    });

    const runtime = store.get(buildSessionRuntimeAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.heartbeatAt).toBe(90);
    expect(runtime.stageId).toBe('geometry');
    expect(runtime.stopReason).toBe('route-leave');
    expect(runtime.inactiveMs).toBe(44);
    expect(runtime.stageStartedAt).toBe(50);
    expect(runtime.stageInactiveMs).toBe(6);
  });

  it('throws when sessionRecord stopReason is outside ShapeBuildStopReason', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    expect(() => {
      adapter.onSessionState({
        nodeId: 'node-1',
        sessionRecord: {
          status: 'running',
          startedAt: 10,
          stageHeartbeatAt: 20,
          stageId: 'geometry',
          stopReason: 'invalid-stop-reason',
        },
      });
    }).toThrowError('[shape buildSessionWorkerEventAdapter] unsupported stopReason: invalid-stop-reason');
  });

  it('maps connection/heartbeat pub/sub events', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onTaskStreamConnectionChanged(true);
    adapter.onHeartbeat({ nodeId: 'node-1', heartbeatAt: 55 });

    const runtime = store.get(buildSessionRuntimeAtom);
    expect(store.get(buildSessionTaskStreamConnectedAtom)).toBe(true);
    expect(runtime.heartbeatAt).toBe(55);
    expect(runtime.phase).toBe('running');
  });
});
