import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearActivePipeline,
  getActivePipeline,
  getPauseState,
  invalidateActivePipeline,
  isActivePipelineRunCurrent,
  registerActivePipeline,
  setPaused,
  waitIfPaused,
} from '../../worker/api/stateManagement';

const NODE_ID = 'shape-active-pipeline-state' as NodeId;

describe('shape active pipeline state', () => {
  afterEach(() => {
    const active = getActivePipeline(NODE_ID);
    if (active) clearActivePipeline(NODE_ID, active.runId);
  });

  it('owns exactly one promise/controller/runId tuple', () => {
    const active = {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-1',
    };
    registerActivePipeline(NODE_ID, active);

    expect(getActivePipeline(NODE_ID)).toBe(active);
    expect(isActivePipelineRunCurrent(NODE_ID, active.runId)).toBe(true);
    expect(() =>
      registerActivePipeline(NODE_ID, {
        promise: Promise.resolve(),
        abortController: new AbortController(),
        runId: 'run-2',
      })
    ).toThrow('active pipeline already exists');
  });

  it('invalidates a timed-out run without clearing a different runId', () => {
    const active = {
      promise: Promise.resolve(),
      abortController: new AbortController(),
      runId: 'run-timeout',
    };
    registerActivePipeline(NODE_ID, active);

    expect(clearActivePipeline(NODE_ID, 'run-stale')).toBe(false);
    expect(invalidateActivePipeline(NODE_ID, active.runId)).toBe(true);
    expect(isActivePipelineRunCurrent(NODE_ID, active.runId)).toBe(false);
    expect(getActivePipeline(NODE_ID)).toBe(active);
  });

  it('updates the Jotai SSOT entry immutably and releases registered waiters on resume', async () => {
    const nodeId = 'shape-pause-state-atom' as NodeId;
    const initial = getPauseState(nodeId);

    await setPaused(nodeId, true);
    const paused = getPauseState(nodeId);
    expect(paused).not.toBe(initial);
    expect(initial.paused).toBe(false);
    expect(paused.paused).toBe(true);

    let released = false;
    const waiting = waitIfPaused(nodeId).then(() => {
      released = true;
    });
    await Promise.resolve();

    expect(getPauseState(nodeId).waiters).toHaveLength(1);
    expect(released).toBe(false);

    await setPaused(nodeId, false);
    await waiting;

    expect(released).toBe(true);
    expect(getPauseState(nodeId).paused).toBe(false);
    expect(getPauseState(nodeId).waiters).toHaveLength(0);
  });
});
