/**
 * Worker-side state management unit tests
 *
 * Covers: PauseState lifecycle, AbortController management, resolveProgressPhase branches
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import {
    getPauseState,
    setPaused,
    setSessionAbortController,
    clearSessionAbortController,
    getSessionAbortController,
    resolveProgressPhase,
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
        expect(state.abortController).toBeNull();
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
        const state = getPauseState(id);
        state.paused = false;
        state.waiters.length = 0;

        let waiterResolved = false;
        state.waiters.push(() => { waiterResolved = true; });

        await setPaused(id, true);

        expect(state.paused).toBe(true);
        // waiters must NOT be released when pausing
        expect(waiterResolved).toBe(false);
        expect(state.waiters).toHaveLength(1);
    });

    it('sets paused=false and releases all waiters', async () => {
        const id = nodeId('node-pause-false');
        const state = getPauseState(id);
        state.paused = true;

        const resolved: number[] = [];
        state.waiters.push(() => { resolved.push(1); });
        state.waiters.push(() => { resolved.push(2); });

        await setPaused(id, false);

        expect(state.paused).toBe(false);
        expect(resolved).toEqual([1, 2]);
        expect(state.waiters).toHaveLength(0);
    });

    it('clears snapshots when resuming (paused=false)', async () => {
        const id = nodeId('node-clear-snapshots');
        const state = getPauseState(id);
        state.paused = true;
        state.waiters.length = 0;

        // taskStateProtection.clearSnapshots is called internally; just verify no throw
        await expect(setPaused(id, false)).resolves.toBeUndefined();
    });

    it('does not release waiters when already paused and paused=true again', async () => {
        const id = nodeId('node-already-paused');
        const state = getPauseState(id);
        state.paused = true;

        let released = false;
        state.waiters.push(() => { released = true; });

        await setPaused(id, true);

        expect(released).toBe(false);
        expect(state.waiters).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// AbortController management
// ---------------------------------------------------------------------------

describe('AbortController management', () => {
    const id = nodeId('node-abort');

    beforeEach(() => {
        clearSessionAbortController(id);
    });

    it('getSessionAbortController returns null before any set', () => {
        expect(getSessionAbortController(id)).toBeNull();
    });

    it('setSessionAbortController stores the controller', () => {
        const ctrl = new AbortController();
        setSessionAbortController(id, ctrl);
        expect(getSessionAbortController(id)).toBe(ctrl);
    });

    it('clearSessionAbortController resets to null', () => {
        const ctrl = new AbortController();
        setSessionAbortController(id, ctrl);
        clearSessionAbortController(id);
        expect(getSessionAbortController(id)).toBeNull();
    });

    it('replaces existing controller when set again', () => {
        const ctrl1 = new AbortController();
        const ctrl2 = new AbortController();
        setSessionAbortController(id, ctrl1);
        setSessionAbortController(id, ctrl2);
        expect(getSessionAbortController(id)).toBe(ctrl2);
    });
});

// ---------------------------------------------------------------------------
// resolveProgressPhase
// ---------------------------------------------------------------------------

describe('resolveProgressPhase', () => {
    it('returns "paused" when node is paused regardless of tasks', () => {
        const id = nodeId('node-progress-paused');
        const state = getPauseState(id);
        state.paused = true;

        // resolveProgressPhase uses summarizeTaskQueueStatus internally;
        // with paused=true it short-circuits before task analysis
        const phase = resolveProgressPhase(id, []);
        expect(phase).toBe('paused');

        state.paused = false;
    });

    it('returns "queued" when not paused and tasks list is empty', () => {
        const id = nodeId('node-progress-queued');
        getPauseState(id).paused = false;

        const phase = resolveProgressPhase(id, []);
        expect(phase).toBe('queued');
    });
});
