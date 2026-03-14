/**
 * Unit tests for UI-side event buffering.
 *
 * session-state / stage-snapshot: FIFO — all events returned in arrival order.
 * task-progress: version-based gate — stale and post-final events are dropped.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    UIEventBufferManager,
    ImmediateHeartbeatProcessor,
    type BufferedEvent,
} from '../../eventBufferingUI';

const makeEvent = (
    notificationType: BufferedEvent['notificationType'],
    payload: unknown,
    version?: number,
): BufferedEvent => ({
    version,
    notificationType,
    payload,
    timestamp: Date.now(),
});

describe('UIEventBufferManager — FIFO queues (session-state / stage-snapshot)', () => {
    let mgr: UIEventBufferManager;

    beforeEach(() => {
        mgr = new UIEventBufferManager();
    });

    it('returns events in arrival order regardless of version', () => {
        mgr.enqueue(makeEvent('session-state', 'a'));
        mgr.enqueue(makeEvent('session-state', 'b'));
        mgr.enqueue(makeEvent('session-state', 'c'));

        const flushed = mgr.flushFifo('session-state');
        expect(flushed.map((e) => e.payload)).toEqual(['a', 'b', 'c']);
    });

    it('flushFifo drains the queue completely', () => {
        mgr.enqueue(makeEvent('stage-snapshot', 'snap1'));
        mgr.enqueue(makeEvent('stage-snapshot', 'snap2'));

        const first = mgr.flushFifo('stage-snapshot');
        expect(first).toHaveLength(2);

        const second = mgr.flushFifo('stage-snapshot');
        expect(second).toHaveLength(0);
    });

    it('session-state and stage-snapshot queues are independent', () => {
        mgr.enqueue(makeEvent('session-state', 'ss1'));
        mgr.enqueue(makeEvent('stage-snapshot', 'sn1'));
        mgr.enqueue(makeEvent('session-state', 'ss2'));

        expect(mgr.flushFifo('session-state').map((e) => e.payload)).toEqual(['ss1', 'ss2']);
        expect(mgr.flushFifo('stage-snapshot').map((e) => e.payload)).toEqual(['sn1']);
    });

    it('enqueue rejects task-progress (must use applyTaskProgress)', () => {
        expect(() => mgr.enqueue(makeEvent('task-progress', {}))).toThrow(
            'task-progress must be applied via applyTaskProgress',
        );
    });

    it('enqueue rejects unknown notification type', () => {
        expect(() =>
            mgr.enqueue({
                version: undefined,
                notificationType: 'unknown' as BufferedEvent['notificationType'],
                payload: {},
                timestamp: Date.now(),
            }),
        ).toThrow('Unknown notification type');
    });

    it('reset clears all queues', () => {
        mgr.enqueue(makeEvent('session-state', 'x'));
        mgr.enqueue(makeEvent('stage-snapshot', 'y'));
        mgr.reset();

        expect(mgr.flushFifo('session-state')).toHaveLength(0);
        expect(mgr.flushFifo('stage-snapshot')).toHaveLength(0);
    });
});

describe('UIEventBufferManager — task-progress version gating', () => {
    let mgr: UIEventBufferManager;

    beforeEach(() => {
        mgr = new UIEventBufferManager();
    });

    it('accepts event when no version info (undefined)', () => {
        const ev = makeEvent('task-progress', { value: 50 });
        expect(mgr.applyTaskProgress(ev)).toBe(ev);
    });

    it('accepts first versioned event', () => {
        const ev = makeEvent('task-progress', { value: 30 }, 5);
        expect(mgr.applyTaskProgress(ev)).toBe(ev);
        expect(mgr.getTaskProgressState().lastAppliedVersion).toBe(5);
    });

    it('accepts higher version', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 10 }, 3));
        const ev = makeEvent('task-progress', { value: 20 }, 6);
        expect(mgr.applyTaskProgress(ev)).toBe(ev);
        expect(mgr.getTaskProgressState().lastAppliedVersion).toBe(6);
    });

    it('drops equal version (duplicate)', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 10 }, 3));
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 10 }, 3))).toBeUndefined();
    });

    it('drops lower version (stale / out-of-order)', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 50 }, 9));
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 40 }, 6))).toBeUndefined();
    });

    it('marks finalReached when value=100 is applied', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 100 }, 10));
        expect(mgr.getTaskProgressState().finalReached).toBe(true);
    });

    it('drops all events after value=100 (final state protection)', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 100 }, 10));
        // Higher version but after final — must be dropped
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 80 }, 13))).toBeUndefined();
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 100 }, 16))).toBeUndefined();
    });

    it('marks finalReached for undefined-version event with value=100', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 100 }));
        expect(mgr.getTaskProgressState().finalReached).toBe(true);
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 50 }))).toBeUndefined();
    });

    it('throws on invalid version (negative)', () => {
        expect(() => mgr.applyTaskProgress(makeEvent('task-progress', { value: 10 }, -1))).toThrow(
            'Invalid task-progress version',
        );
    });

    it('throws on invalid version (NaN)', () => {
        expect(() => mgr.applyTaskProgress(makeEvent('task-progress', { value: 10 }, NaN))).toThrow(
            'Invalid task-progress version',
        );
    });

    it('throws when called with wrong notification type', () => {
        expect(() =>
            mgr.applyTaskProgress(makeEvent('session-state', {})),
        ).toThrow('applyTaskProgress called with wrong type');
    });

    it('reset clears version state', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 100 }, 5));
        mgr.reset();
        const state = mgr.getTaskProgressState();
        expect(state.lastAppliedVersion).toBeUndefined();
        expect(state.finalReached).toBe(false);
        // Should accept again after reset
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 50 }, 3))).toBeDefined();
    });

    it('parallel worker interleaving: Worker0=0,3,6 Worker1=1,4,7 Worker2=2,5,8', () => {
        // Simulate 3 parallel workers emitting interleaved versions
        const versions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const accepted: number[] = [];
        for (const v of versions) {
            const result = mgr.applyTaskProgress(makeEvent('task-progress', { value: v * 10 }, v));
            if (result) accepted.push(v);
        }
        expect(accepted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('out-of-order delivery: later version arrives first, earlier is dropped', () => {
        mgr.applyTaskProgress(makeEvent('task-progress', { value: 60 }, 6));
        // version 3 arrives late — stale
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 30 }, 3))).toBeUndefined();
        // version 9 is fine
        expect(mgr.applyTaskProgress(makeEvent('task-progress', { value: 90 }, 9))).toBeDefined();
    });
});

describe('ImmediateHeartbeatProcessor', () => {
    it('passes heartbeat events through immediately', () => {
        const received: Array<{ nodeId: string; heartbeatAt?: number }> = [];
        const proc = new ImmediateHeartbeatProcessor((e) => received.push(e));

        proc.processHeartbeat({ nodeId: 'n1', heartbeatAt: 1000 });
        proc.processHeartbeat({ nodeId: 'n1', heartbeatAt: 2000 });

        expect(received).toEqual([
            { nodeId: 'n1', heartbeatAt: 1000 },
            { nodeId: 'n1', heartbeatAt: 2000 },
        ]);
    });

    it('handles heartbeat without heartbeatAt', () => {
        const received: Array<{ nodeId: string; heartbeatAt?: number }> = [];
        const proc = new ImmediateHeartbeatProcessor((e) => received.push(e));
        proc.processHeartbeat({ nodeId: 'n1' });
        expect(received).toEqual([{ nodeId: 'n1' }]);
    });
});
