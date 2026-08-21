/**
 * Worker-side state management unit tests
 *
 * Covers: PauseState lifecycle, active pipeline ownership, resolveBuildStatus branches
 */

import type { NodeId } from '@hierarchidb/core-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearActivePipeline,
  getActivePipeline,
  getPauseState,
  invalidateActivePipeline,
  isActivePipelineRunCurrent,
  registerActivePipeline,
  resolveBuildStatus,
  setPaused,
  waitIfPaused,
} from '../../api/stateManagement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nodeId = (id: string): NodeId => id as NodeId;

// ---------------------------------------------------------------------------
// getPauseState
// ---------------------------------------------------------------------------

describe('getPauseState', () => {
  it('initializes a new PauseState with defaults', () => {
    const state = getPauseState(nodeId('node-init'));
    expect(state.paused).toBe(false);
    expect(state.waiters).toHaveLength(0);
    expect(state.activePipeline).toBeNull();
    expect(state.invalidatedRunId).toBeNull();
  });

  it('returns the same instance on repeated calls for the same nodeId', () => {
    const a = getPauseState(nodeId('node-reuse'));
    const b = getPauseState(nodeId('node-reuse'));
    expect(a).toBe(b);
  });

  it('returns distinct instances for different nodeIds', () => {
    const a = getPauseState(nodeId('node-distinct-a'));
    const b = getPauseState(nodeId('node-distinct-b'));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// setPaused
// ---------------------------------------------------------------------------

describe('setPaused', () => {
  it('sets paused=true and does not release waiters', async () => {
    const id = nodeId('node-pause-true');
    await setPaused(id, true);

    let waiterResolved = false;
    const waiting = waitIfPaused(id).then(() => {
      waiterResolved = true;
    });
    await Promise.resolve();

    await setPaused(id, true);

    expect(getPauseState(id).paused).toBe(true);
    // waiters must NOT be released when pausing
    expect(waiterResolved).toBe(false);
    expect(getPauseState(id).waiters).toHaveLength(1);

    await setPaused(id, false);
    await waiting;
  });

  it('sets paused=false and releases all waiters', async () => {
    const id = nodeId('node-pause-false');
    await setPaused(id, true);

    const resolved: number[] = [];
    const firstWaiter = waitIfPaused(id).then(() => {
      resolved.push(1);
    });
    const secondWaiter = waitIfPaused(id).then(() => {
      resolved.push(2);
    });
    await Promise.resolve();

    await setPaused(id, false);
    await Promise.all([firstWaiter, secondWaiter]);

    expect(getPauseState(id).paused).toBe(false);
    expect(resolved).toEqual([1, 2]);
    expect(getPauseState(id).waiters).toHaveLength(0);
  });

  it('clears snapshots when resuming (paused=false)', async () => {
    const id = nodeId('node-clear-snapshots');
    await setPaused(id, true);

    // taskStateProtection.clearSnapshots is called internally; just verify no throw
    await expect(setPaused(id, false)).resolves.toBeUndefined();
  });

  it('does not release waiters when already paused and paused=true again', async () => {
    const id = nodeId('node-already-paused');
    await setPaused(id, true);

    let released = false;
    const waiting = waitIfPaused(id).then(() => {
      released = true;
    });
    await Promise.resolve();

    await setPaused(id, true);

    expect(released).toBe(false);
    expect(getPauseState(id).waiters).toHaveLength(1);

    await setPaused(id, false);
    await waiting;
  });
});

// ---------------------------------------------------------------------------
// Active pipeline management
// ---------------------------------------------------------------------------

describe('active pipeline management', () => {
  const id = nodeId('node-active-pipeline');

  beforeEach(() => {
    const active = getActivePipeline(id);
    if (active) clearActivePipeline(id, active.runId);
  });

  it('returns null before registration', () => {
    expect(getActivePipeline(id)).toBeNull();
  });

  it('stores one promise/controller/runId tuple', () => {
    const active = {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-1',
    };
    registerActivePipeline(id, active);
    expect(getActivePipeline(id)).toBe(active);
    expect(isActivePipelineRunCurrent(id, active.runId)).toBe(true);
  });

  it('does not clear a newer run with a stale runId', () => {
    const active = {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-current',
    };
    registerActivePipeline(id, active);
    expect(clearActivePipeline(id, 'run-stale')).toBe(false);
    expect(getActivePipeline(id)).toBe(active);
  });

  it('invalidates a timed-out run until its exact tuple is cleared', () => {
    const active = {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-timeout',
    };
    registerActivePipeline(id, active);
    expect(invalidateActivePipeline(id, active.runId)).toBe(true);
    expect(isActivePipelineRunCurrent(id, active.runId)).toBe(false);
    expect(getActivePipeline(id)).toBe(active);
    expect(clearActivePipeline(id, active.runId)).toBe(true);
    expect(getActivePipeline(id)).toBeNull();
    expect(getPauseState(id).invalidatedRunId).toBeNull();
  });

  it('rejects registration while another run is active', () => {
    registerActivePipeline(id, {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-existing',
    });
    expect(() =>
      registerActivePipeline(id, {
        promise: Promise.resolve(),
        abortController: new AbortController(),
        runId: 'run-conflict',
      })
    ).toThrow('active pipeline already exists');
  });
});

// ---------------------------------------------------------------------------
// resolveBuildStatus
// ---------------------------------------------------------------------------

describe('resolveBuildStatus', () => {
  it('returns "paused" when node is paused regardless of tasks', async () => {
    const id = nodeId('node-progress-paused');
    await setPaused(id, true);

    // resolveBuildStatus uses summarizeTaskQueueStatus internally;
    // with paused=true it short-circuits before task analysis
    const phase = resolveBuildStatus(id, []);
    expect(phase).toBe('paused');

    await setPaused(id, false);
  });

  it('returns "queued" when not paused and tasks list is empty', () => {
    const id = nodeId('node-progress-queued');

    const phase = resolveBuildStatus(id, []);
    expect(phase).toBe('queued');
  });
});
