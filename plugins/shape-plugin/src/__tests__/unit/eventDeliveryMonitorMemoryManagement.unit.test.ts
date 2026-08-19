/**
 * Unit tests for UIEventBufferManager state management.
 *
 * session-state and stage-snapshot use FIFO queues (unconditional, arrival order).
 * task-progress uses per-taskId version deduplication via applyTaskProgress().
 * Per build-session-worker-ui-event-spec.md:
 *   "Per-task deduplication: version > lastAppliedVersion[taskId] → accept,
 *    version <= lastAppliedVersion[taskId] → drop."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    UIEventBufferManager,
    type BufferedEvent,
} from '../../ui/components/build-progress/eventBufferingUI';

const makeFifoEvent = (
    notificationType: 'session-state' | 'stage-snapshot',
    index = 0,
): BufferedEvent => ({
    notificationType,
    payload: { index },
    timestamp: Date.now(),
});

describe('UIEventBufferManager state management', () => {
    let manager: UIEventBufferManager;

    beforeEach(() => {
        manager = new UIEventBufferManager();
    });

    // -----------------------------------------------------------------------
    // Initial state
    // -----------------------------------------------------------------------

    describe('Initial state', () => {
        it('starts with empty FIFO queues for session-state and stage-snapshot', () => {
            expect(manager.flushFifo('session-state')).toEqual([]);
            expect(manager.flushFifo('stage-snapshot')).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // FIFO queue behaviour — session-state and stage-snapshot
    // -----------------------------------------------------------------------

    describe('FIFO queue behaviour', () => {
        it('preserves insertion order for session-state', () => {
            const events = Array.from({ length: 5 }, (_, i) => makeFifoEvent('session-state', i));
            events.forEach((ev) => manager.enqueue(ev));

            const flushed = manager.flushFifo('session-state');
            expect(flushed.length).toBe(5);
            flushed.forEach((ev, i) => {
                expect((ev.payload as { index: number }).index).toBe(i);
            });
        });

        it('preserves insertion order for stage-snapshot', () => {
            const events = Array.from({ length: 3 }, (_, i) => makeFifoEvent('stage-snapshot', i));
            events.forEach((ev) => manager.enqueue(ev));

            const flushed = manager.flushFifo('stage-snapshot');
            expect(flushed.length).toBe(3);
            flushed.forEach((ev, i) => {
                expect((ev.payload as { index: number }).index).toBe(i);
            });
        });

        it('flushFifo drains the queue completely', () => {
            manager.enqueue(makeFifoEvent('session-state'));
            manager.enqueue(makeFifoEvent('session-state'));

            const first = manager.flushFifo('session-state');
            const second = manager.flushFifo('session-state');

            expect(first.length).toBe(2);
            expect(second.length).toBe(0);
        });

        it('session-state and stage-snapshot queues are independent', () => {
            manager.enqueue(makeFifoEvent('session-state', 0));
            manager.enqueue(makeFifoEvent('session-state', 1));
            manager.enqueue(makeFifoEvent('stage-snapshot', 0));

            expect(manager.flushFifo('session-state').length).toBe(2);
            expect(manager.flushFifo('stage-snapshot').length).toBe(1);
        });

        it('enqueue throws for task-progress (must use applyTaskProgress)', () => {
            expect(() => {
                manager.enqueue({
                    notificationType: 'task-progress',
                    payload: {},
                    timestamp: Date.now(),
                });
            }).toThrow();
        });

        it('enqueue throws for unknown notification type', () => {
            expect(() => {
                manager.enqueue({
                    notificationType: 'unknown' as BufferedEvent['notificationType'],
                    payload: {},
                    timestamp: Date.now(),
                });
            }).toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // task-progress: per-taskId version deduplication
    // -----------------------------------------------------------------------

    describe('task-progress per-taskId version deduplication', () => {
        it('accepts first event for a taskId', () => {
            const result = manager.applyTaskProgress('task-1', 1);
            expect(result).toBe(true);
        });

        it('accepts event with higher version', () => {
            manager.applyTaskProgress('task-1', 5);
            const result = manager.applyTaskProgress('task-1', 7);
            expect(result).toBe(true);
        });

        it('drops event with equal version (duplicate)', () => {
            manager.applyTaskProgress('task-1', 5);
            const result = manager.applyTaskProgress('task-1', 5);
            expect(result).toBe(false);
        });

        it('drops event with lower version (stale)', () => {
            manager.applyTaskProgress('task-1', 10);
            const result = manager.applyTaskProgress('task-1', 3);
            expect(result).toBe(false);
        });

        it('tracks versions independently per taskId', () => {
            manager.applyTaskProgress('task-A', 10);
            const acceptedB = manager.applyTaskProgress('task-B', 1);
            const staleA = manager.applyTaskProgress('task-A', 9);

            expect(acceptedB).toBe(true);
            expect(staleA).toBe(false);
        });

        it('accepts monotonically increasing versions', () => {
            const results = [1, 2, 3, 4, 5].map((v) =>
                manager.applyTaskProgress('task-1', v)
            );
            expect(results.every((result) => result)).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // reset
    // -----------------------------------------------------------------------

    describe('reset', () => {
        it('clears all FIFO queues', () => {
            manager.enqueue(makeFifoEvent('session-state'));
            manager.enqueue(makeFifoEvent('stage-snapshot'));
            manager.reset();

            expect(manager.flushFifo('session-state').length).toBe(0);
            expect(manager.flushFifo('stage-snapshot').length).toBe(0);
        });

        it('clears per-taskId version state', () => {
            manager.applyTaskProgress('task-1', 10);
            manager.reset();
            // After reset, version 1 must be accepted again
            const result = manager.applyTaskProgress('task-1', 1);
            expect(result).toBe(true);
        });

        it('allows new FIFO events after reset', () => {
            manager.enqueue(makeFifoEvent('session-state'));
            manager.reset();

            manager.enqueue(makeFifoEvent('session-state', 99));
            const flushed = manager.flushFifo('session-state');
            expect(flushed.length).toBe(1);
            expect((flushed[0].payload as { index: number }).index).toBe(99);
        });

        it('multiple resets are idempotent', () => {
            manager.enqueue(makeFifoEvent('session-state'));
            manager.reset();
            manager.reset();
            manager.reset();

            expect(manager.flushFifo('session-state').length).toBe(0);
        });
    });
});
