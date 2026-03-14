import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';
import type { BuildProgressEvent, BuildSessionRuntimeRecord, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import {
  buildSessionLifecycleAtom,
  buildSessionStageCountersAtom,
  buildSessionStageProgressAtom,
  buildSessionTaskStreamConnectedAtom,
  stageTimingByStageAtom,
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

  it('maps runtime pub/sub event to sessionStatusUpdated', () => {
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

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.isActive).toBe(true);
    expect(runtime.heartbeatAt).toBeUndefined(); // heartbeatAt comes from onHeartbeat, not onRuntimeRecord
    expect(runtime.startedAt).toBe(10);
  });

  it('maps task pub/sub snapshot to stage counters', () => {
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

    const counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.queued).toBe(1);
  });

  it('replaces tasks on second snapshot (full snapshot semantics)', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);

    adapter.onTaskEvent({
      type: 'snapshot',
      nodeId: 'node-1',
      tasks: [
        { taskId: 's-1', version: 1, stage: 'source', status: 'queued', progress: 0 },
        { taskId: 's-2', version: 1, stage: 'source', status: 'running', progress: 10 },
      ],
    });
    expect(store.get(buildSessionStageCountersAtom).source.total).toBe(2);

    // Second snapshot replaces entirely
    adapter.onTaskEvent({
      type: 'snapshot',
      nodeId: 'node-1',
      tasks: [
        { taskId: 's-1', version: 2, stage: 'source', status: 'completed', progress: 100 },
      ],
    });

    const counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(1);
    expect(counters.terminal).toBe(1);
    expect(counters.running).toBe(0);
  });

  it('throws on task update event (only snapshot is supported)', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    const updateEvent: BuildTaskUpdateEvent = {
      type: 'update',
      nodeId: 'node-1',
      task: { taskId: 's-1', version: 4, stage: 'source', status: 'completed', progress: 100 },
    };
    expect(() => adapter.onTaskEvent(updateEvent)).toThrowError(
      "unexpected task event type: update. Only 'snapshot' is supported.",
    );
  });

  it('maps progress pub/sub event to taskProgressUpdated and updates stage progress', () => {
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

  it('maps onSessionState to sessionStatusUpdated with stopReason', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onSessionState({
      nodeId: 'node-1',
      sessionRecord: {
        status: 'running',
        startedAt: 10,
        stageHeartbeatAt: 90,
        stopReason: 'route-leave',
      },
    });

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('running');
    expect(runtime.startedAt).toBe(10);
    expect(runtime.stopReason).toBe('route-leave');
  });

  it('maps onSessionState with status queued to phase queued (isActive=true)', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onSessionState({
      nodeId: 'node-1',
      sessionRecord: {
        status: 'queued',
        startedAt: 100,
      },
    });

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('queued');
    expect(runtime.isActive).toBe(true);
    expect(runtime.startedAt).toBe(100);
  });

  it('stores stage timing from stageSnapshotUpdated via onTaskEvent', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    // onTaskEvent snapshot sets stageStartedAt via stageSnapshotUpdated
    adapter.onTaskEvent({
      type: 'snapshot',
      nodeId: 'node-1',
      tasks: [{ taskId: 's-1', version: 50, stage: 'geometry', status: 'running', progress: 10 }],
    });

    const timing = store.get(stageTimingByStageAtom);
    // stageStartedAt is derived from task version when no explicit version on event
    expect(timing.geometry).not.toBeNull();
    expect(timing.geometry?.stageInactiveMs).toBe(0);
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

  it('maps connection and heartbeat events', () => {
    const adapter = createBuildSessionWorkerEventAdapter('node-1', dispatch);
    adapter.onTaskStreamConnectionChanged(true);
    adapter.onHeartbeat({ nodeId: 'node-1', heartbeatAt: 55 });

    expect(store.get(buildSessionTaskStreamConnectedAtom)).toBe(true);
    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.heartbeatAt).toBe(55);
    // heartbeat does not change phase; phase remains idle
    expect(runtime.phase).toBe('idle');
  });
});
