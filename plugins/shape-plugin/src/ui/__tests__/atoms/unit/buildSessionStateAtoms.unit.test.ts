import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from 'jotai/vanilla';
import type { BuildTaskSummary } from '@hierarchidb/build-api';
import {
  buildSessionLifecycleAtom,
  buildSessionStageCountersAtom,
  buildSessionStartButtonLoadingAtom,
  buildSessionTaskListViewPhaseAtom,
  buildSessionStageProgressAtom,
  buildSessionTasksByStageAtom,
  buildSessionSnapshotHandshakeReceivedAtom,
  stageDurationMsByStageAtom,
  pendingUserActionAtom,
  isStopRequestedInFlightAtom,
  completionSnapshotAtom,
  completionDialogOpenAtom,
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
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: 'node-1',
        phase: 'running',
        isActive: true,
      },
    });

    expect(store.get(buildSessionLifecycleAtom).phase).toBe('running');
    expect(store.get(buildSessionStartButtonLoadingAtom)).toBe(true);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskStreamConnectionChanged',
      payload: {
        connected: true,
      },
    });

    expect(store.get(buildSessionStartButtonLoadingAtom)).toBe(false);
  });

  it('builds stage counters from task snapshot', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [
          createTask({ taskId: 't-q', status: 'queued', progress: 0 }),
          createTask({ taskId: 't-r', status: 'running', progress: 10 }),
          createTask({ taskId: 't-c', status: 'completed', progress: 100 }),
        ],
        stageStartedAt: 1000,
        stageInactiveMs: 0,
      },
    });

    const counters = store.get(buildSessionStageCountersAtom).source;
    expect(counters.total).toBe(3);
    expect(counters.queued).toBe(1);
    expect(counters.running).toBe(1);
    expect(counters.terminal).toBe(1);
    expect(counters.failed).toBe(0);
  });

  it('computes completed stage duration without clamping', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [],
        stageStartedAt: 1_000,
        stageInactiveMs: 100,
        stageCompletedAt: 1_600,
      },
    });
    expect(store.get(stageDurationMsByStageAtom).source).toBe(500);
  });

  it('rejects a reversed completed stage interval', () => {
    expect(() => store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [],
        stageStartedAt: 1_000,
        stageInactiveMs: 100,
        stageCompletedAt: 1_050,
      },
    })).toThrowError('stage duration must be finite and non-negative');
  });

  it('rejects out-of-range progress instead of normalizing it', () => {
    expect(() => {
      store.set(dispatchBuildSessionEventAtom, {
        type: 'taskProgressUpdated',
        payload: {
          stageId: 'geometry',
          value: 120,
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
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [taskWithTitle],
        stageStartedAt: 1000,
        stageInactiveMs: 0,
      },
    });

    const sourceTasks = store.get(buildSessionTasksByStageAtom).source as Array<BuildTaskSummary & { title?: string }>;
    expect(sourceTasks).toHaveLength(1);
    expect(sourceTasks[0]?.title).toBe('Japan (JP) 0');
  });

  it('keeps ui-initializing before snapshot and switches to streaming after snapshot', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
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
      type: 'taskProgressUpdated',
      payload: {
        stageId: 'geometry',
        value: 33,
      },
    });
    expect(store.get(buildSessionStageProgressAtom).geometry).toBe(33);

    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'geometry',
        tasks: [],
        stageStartedAt: 1000,
        stageInactiveMs: 0,
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

// =============================================================================
// Full lifecycle phase transitions
// =============================================================================

describe('full lifecycle phase transitions', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  const dispatchPhase = (phase: string) => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: phase as never, isActive: true },
    });
  };

  it('transitions idle → starting → running', () => {
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('idle');
    dispatchPhase('starting');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('starting');
    dispatchPhase('running');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('running');
  });

  it('transitions running → pausing → paused → resuming → running', () => {
    dispatchPhase('running');
    dispatchPhase('pausing');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('pausing');
    dispatchPhase('paused');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('paused');
    dispatchPhase('resuming');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('resuming');
    dispatchPhase('running');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('running');
  });

  it('transitions running → finalizing → completed', () => {
    dispatchPhase('running');
    dispatchPhase('finalizing');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('finalizing');
    dispatchPhase('completed');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('completed');
  });

  it('transitions running → failed', () => {
    dispatchPhase('running');
    dispatchPhase('failed');
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('failed');
  });

  it('sessionStatusUpdated sets isActive=false for failed phase', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'failed', isActive: false },
    });
    expect(store.get(buildSessionLifecycleAtom).phase).toBe('failed');
    expect(store.get(buildSessionLifecycleAtom).isActive).toBe(false);
  });
});

// =============================================================================
// sessionStatusUpdated lifecycle extras
// =============================================================================

describe('sessionStatusUpdated lifecycle extras', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('stores startedAt and stopReason', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: 'node-1',
        phase: 'paused',
        isActive: false,
        startedAt: 100,
        stopReason: 'user-pause',
      },
    });
    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('paused');
    expect(runtime.startedAt).toBe(100);
    expect(runtime.stopReason).toBe('user-pause');
  });

  it('stores completedAt on completed phase', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: 'node-1',
        phase: 'completed',
        isActive: false,
        completedAt: 9999,
        stopReason: 'completed',
      },
    });
    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('completed');
    expect(runtime.completedAt).toBe(9999);
    expect(runtime.stopReason).toBe('completed');
  });
});

// =============================================================================
// criticalError → forced failed transition
// =============================================================================

describe('criticalError event', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('forces phase to failed and stores error details', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'running', isActive: true },
    });

    store.set(dispatchBuildSessionEventAtom, {
      type: 'criticalError',
      payload: {
        nodeId: 'node-1',
        message: 'contract violation',
        error: 'Error: bad value',
        errorName: 'Error',
        timestamp: 12345,
        severity: 'critical',
        contractViolation: true,
      },
    });

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('failed');
    expect(runtime.isActive).toBe(false);
    expect(runtime.criticalError).toBeDefined();
    expect(runtime.criticalError?.contractViolation).toBe(true);
    expect(runtime.criticalError?.message).toBe('contract violation');
    expect(runtime.stopReason).toBe('failed');
    expect(runtime.completedAt).toBe(12345);
  });

  it('forces failed even from paused phase', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'paused', isActive: false },
    });

    store.set(dispatchBuildSessionEventAtom, {
      type: 'criticalError',
      payload: {
        nodeId: 'node-1',
        message: 'abort error',
        error: 'AbortError',
        errorName: 'AbortError',
        timestamp: 99999,
        severity: 'critical',
        contractViolation: false,
      },
    });

    expect(store.get(buildSessionLifecycleAtom).phase).toBe('failed');
  });
});

// =============================================================================
// reset event
// =============================================================================

describe('reset event', () => {
  const store = createStore();

  it('resets all atoms to initial state', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'running', isActive: true },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'taskStreamConnectionChanged',
      payload: { connected: true },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [{ taskId: 't1', version: 1, stage: 'source', status: 'running', progress: 50 }],
        stageStartedAt: 1000,
        stageInactiveMs: 0,
      },
    });

    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });

    const runtime = store.get(buildSessionLifecycleAtom);
    expect(runtime.phase).toBe('idle');
    expect(runtime.isActive).toBe(false);
    expect(runtime.startedAt).toBeUndefined();
    expect(runtime.criticalError).toBeUndefined();
    expect(store.get(buildSessionStageCountersAtom).source.total).toBe(0);
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(false);
  });
});

// =============================================================================
// viewSelectionChanged event
// =============================================================================

describe('viewSelectionChanged event', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('updates activeStageId', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'viewSelectionChanged',
      payload: { activeStageId: 'geometry' },
    });
    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('geometry');
  });

  it('updates activeStageId to tileEmit', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'viewSelectionChanged',
      payload: { activeStageId: 'tileEmit' },
    });
    expect(store.get(buildSessionLifecycleAtom).activeStageId).toBe('tileEmit');
  });
});

// =============================================================================
// buildSessionTaskListViewPhaseAtom – all branches
// =============================================================================

describe('buildSessionTaskListViewPhaseAtom branches', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('returns "idle" when phase is idle and no tasks', () => {
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('idle');
  });

  it('returns "ui-initializing" when active phase but uiSync is ui-initializing and no tasks', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'running', isActive: true },
    });
    // uiSyncPhase defaults to ui-initializing after reset
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('ui-initializing');
  });

  it('returns "streaming" when tasks exist regardless of uiSync phase', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'running', isActive: true },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [{ taskId: 't1', version: 1, stage: 'source', status: 'running', progress: 10 }],
        stageStartedAt: 1000,
        stageInactiveMs: 0,
      },
    });
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('streaming');
  });

  it('returns "settledEmpty" when phase is completed and no tasks', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'completed', isActive: false },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: { stageId: 'source', phase: 'running' },
    });
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('settledEmpty');
  });

  it('returns "settledEmpty" when phase is failed and no tasks', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'sessionStatusUpdated',
      payload: { nodeId: 'node-1', phase: 'failed', isActive: false },
    });
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: { stageId: 'source', phase: 'running' },
    });
    expect(store.get(buildSessionTaskListViewPhaseAtom)).toBe('settledEmpty');
  });
});

// =============================================================================
// pendingUserActionAtom / isStopRequestedInFlightAtom
// =============================================================================

describe('pendingUserActionAtom', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('defaults to "none"', () => {
    expect(store.get(pendingUserActionAtom)).toBe('none');
  });

  it('transitions to "starting"', () => {
    store.set(pendingUserActionAtom, 'starting');
    expect(store.get(pendingUserActionAtom)).toBe('starting');
    expect(store.get(isStopRequestedInFlightAtom)).toBe(false);
  });

  it('transitions to "stopping" and isStopRequestedInFlight becomes true', () => {
    store.set(pendingUserActionAtom, 'stopping');
    expect(store.get(isStopRequestedInFlightAtom)).toBe(true);
  });

  it('transitions to "pausing" and isStopRequestedInFlight becomes true', () => {
    store.set(pendingUserActionAtom, 'pausing');
    expect(store.get(isStopRequestedInFlightAtom)).toBe(true);
  });

  it('transitions to "cancelling" and isStopRequestedInFlight becomes true', () => {
    store.set(pendingUserActionAtom, 'cancelling');
    expect(store.get(isStopRequestedInFlightAtom)).toBe(true);
  });

  it('no-ops when setting same value', () => {
    store.set(pendingUserActionAtom, 'stopping');
    store.set(pendingUserActionAtom, 'stopping');
    expect(store.get(pendingUserActionAtom)).toBe('stopping');
  });
});

// =============================================================================
// completionSnapshotAtom / completionDialogOpenAtom
// =============================================================================

describe('completionSnapshotAtom and completionDialogOpenAtom', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('completionSnapshotAtom defaults to null', () => {
    expect(store.get(completionSnapshotAtom)).toBeNull();
  });

  it('stores completion snapshot data', () => {
    store.set(completionSnapshotAtom, {
      status: 'completed',
      stageLabel: 'Source',
      taskTitle: 'Japan (JP)',
    });
    const snap = store.get(completionSnapshotAtom);
    expect(snap?.status).toBe('completed');
    expect(snap?.stageLabel).toBe('Source');
    expect(snap?.taskTitle).toBe('Japan (JP)');
  });

  it('completionDialogOpenAtom defaults to false', () => {
    expect(store.get(completionDialogOpenAtom)).toBe(false);
  });

  it('completionDialogOpenAtom can be set to true', () => {
    store.set(completionDialogOpenAtom, true);
    expect(store.get(completionDialogOpenAtom)).toBe(true);
  });

  it('reset clears completionSnapshot and dialog', () => {
    store.set(completionSnapshotAtom, { status: 'failed', stageLabel: 'Geometry' });
    store.set(completionDialogOpenAtom, true);
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
    expect(store.get(completionSnapshotAtom)).toBeNull();
    expect(store.get(completionDialogOpenAtom)).toBe(false);
  });
});

// =============================================================================
// buildSessionSnapshotHandshakeReceivedAtom
// =============================================================================

describe('buildSessionSnapshotHandshakeReceivedAtom', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
  });

  it('is false initially', () => {
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(false);
  });

  it('becomes true when any stage uiSyncPhase transitions to running', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: { stageId: 'tileEmit', phase: 'running' },
    });
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(true);
  });

  it('resets to false after reset event', () => {
    store.set(dispatchBuildSessionEventAtom, {
      type: 'uiSyncPhaseChanged',
      payload: { stageId: 'source', phase: 'running' },
    });
    store.set(dispatchBuildSessionEventAtom, { type: 'reset' });
    expect(store.get(buildSessionSnapshotHandshakeReceivedAtom)).toBe(false);
  });
});
