import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';
import type { BuildTaskSummary } from '@hierarchidb/build-api';
import {
  buildSessionRuntimeAtom,
  buildSessionStageCountersAtom,
  buildSessionStartButtonLoadingAtom,
  buildSessionTaskListViewPhaseAtom,
  buildSessionStageProgressAtom,
  buildSessionTasksByStageAtom,
  dispatchBuildSessionEventAtom,
} from '../../../atoms/buildSessionStateAtoms';

const createTask = (overrides: Partial<BuildTaskSummary> = {}): BuildTaskSummary => ({
  taskId: 'task-1',
  version: 1,
  stage: 'source',
  status: 'queued',
  progress: 0,
  ...overrides,
});

describe('buildSessionStateAtoms write atom', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('applies runtime snapshot and toggles start button loading from selector', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'runtimeSnapshotReceived',
      eventVersion: 1,
      payload: {
        nodeId: 'node-1',
        phase: 'running',
        isActive: true,
      },
    });

    expect(store.get(buildSessionRuntimeAtom).phase).toBe('running');
    expect(store.get(buildSessionStartButtonLoadingAtom)).toBe(true);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskStreamConnectionChanged',
      payload: {
        connected: true,
      },
    });

    expect(store.get(buildSessionStartButtonLoadingAtom)).toBe(false);
  });

  it('drops stale events by eventVersion monotonicity', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'runtimeSnapshotReceived',
      eventVersion: 10,
      payload: {
        nodeId: 'node-1',
        phase: 'running',
        isActive: true,
      },
    });

    store.set(dispatchBuildSessionEventAtom, {
      type: 'runtimeSnapshotReceived',
      eventVersion: 9,
      payload: {
        nodeId: 'node-1',
        phase: 'failed',
        isActive: false,
      },
    });

    const runtime = store.get(buildSessionRuntimeAtom);
    expect(runtime.lastAcceptedEventVersion).toBe(10);
    expect(runtime.phase).toBe('running');
  });

  it('builds stage counters from task snapshot and update', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskSnapshotReceived',
      eventVersion: 1,
      payload: {
        stageId: 'source',
        tasks: [
          createTask({ taskId: 't-q', status: 'queued', progress: 0 }),
          createTask({ taskId: 't-r', status: 'running', progress: 10 }),
          createTask({ taskId: 't-c', status: 'completed', progress: 100 }),
        ],
      },
    });

    let counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(3);
    expect(counters.queued).toBe(1);
    expect(counters.running).toBe(1);
    expect(counters.terminal).toBe(1);
    expect(counters.failed).toBe(0);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskUpdated',
      eventVersion: 2,
      payload: {
        stageId: 'source',
        task: createTask({ taskId: 't-r', status: 'failed', progress: 100 }),
      },
    });

    counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(3);
    expect(counters.queued).toBe(1);
    expect(counters.running).toBe(0);
    expect(counters.terminal).toBe(2);
    expect(counters.failed).toBe(1);
  });

  it('rejects out-of-range progress instead of normalizing it', () => {
    expect(() => {
      store.set(dispatchBuildSessionEventAtom, {
        type: 'progressReceived',
        eventVersion: 1,
        payload: {
          stageId: 'geometry',
          value: 120,
          phase: 'running',
        },
      });
    }).toThrowError('progress must be within 0..100');
  });

  it('preserves task title from snapshot for task cards', () => {
    const taskWithTitle = createTask({
      taskId: 't-source',
      status: 'running',
      progress: 42,
    }) as BuildTaskSummary & { title?: string };
    taskWithTitle.title = 'Japan (JP) 0';

    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskSnapshotReceived',
      eventVersion: 1,
      payload: {
        stageId: 'source',
        tasks: [taskWithTitle],
      },
    });

    const sourceTasks = store.get(buildSessionTasksByStageAtom).source as Array<BuildTaskSummary & { title?: string }>;
    expect(sourceTasks).toHaveLength(1);
    expect(sourceTasks[0]?.title).toBe('Japan (JP) 0');
  });

  it('keeps ui-initializing before snapshot and switches to running after snapshot', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'runtimeSnapshotReceived',
      eventVersion: 1,
      payload: {
        nodeId: 'node-1',
        phase: 'running',
        isActive: true,
      },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: {
        stageId: 'geometry',
        phase: 'ui-initializing',
      },
    });
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('ui-initializing');

    store.set(dispatchBuildSessionEventAtom, {
      type: 'progressReceived',
      eventVersion: 2,
      payload: {
        stageId: 'geometry',
        value: 33,
        phase: 'running',
      },
    });
    expect(store.get(buildSessionStageProgressAtom).geometry).toBe(33);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskSnapshotReceived',
      eventVersion: 3,
      payload: {
        stageId: 'geometry',
        tasks: [],
      },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: {
        stageId: 'geometry',
        phase: 'running',
      },
    });
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('streaming');
  });
});
