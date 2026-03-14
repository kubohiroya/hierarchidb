/**
 * Unit tests for UIEventBufferManager state management.
 * Replaces the old EventDeliveryMonitor memory management tests (removed in the
 * FIFO+version-gate redesign).  The current UI-side API is:
 *   UIEventBufferManager.enqueue / flushFifo / applyTaskProgress / reset / getTaskProgressState
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    UIEventBufferManager,
    type BufferedEvent,
} from '../../ui/components/build-progress/eventBufferingUI';

const makeSessionEvent = (index = 0): BufferedEvent => ({
    notificationType: 'session-state',
    version: undefined,
    payload: { index },
    timestamp: Date.now(),
});

const makeStageEvent = (index = 0): BufferedEvent => ({
    notificationType: 'stage-snapshot',
    version: undefined,
    payload: { index },
    timestamp: Date.now(),
});

const makeTaskEvent = (version: number, value = 50): BufferedEvent => ({
    notificationType: 'task-progress',
    version,
    payload: { value },
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
        it('starts with empty FIFO queues', () => {
            expect(manager.flushFifo('session-state')).toEqual([]);
            expect(manager.flushFifo('stage-snapshot')).toEqual([]);
        });

        it('starts with clean task-progress state', () => {
            const state = manager.getTaskProgressState();
            expect(state.finalReached).toBe(false);
            expect(state.lastAppliedVersion).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // FIFO queue behaviour
    // -----------------------------------------------------------------------

    describe('FIFO queue behaviour', () => {
        it('preserves insertion order for session-state', () => {
            const events = Array.from({ length: 5 }, (_, i) => makeSessionEvent(i));
            events.forEach((ev) => manager.enqueue(ev));

            const flushed = manager.flushFifo('session-state');
            expect(flushed.length).toBe(5);
            flushed.forEach((ev, i) => {
                expect((ev.payload as { index: number }).index).toBe(i);
            });
        });

        it('preserves insertion order for stage-snapshot', () => {
            const events = Array.from({ length: 3 }, (_, i) => makeStageEvent(i));
            events.forEach((ev) => manager.enqueue(ev));

            const flushed = manager.flushFifo('stage-snapshot');
            expect(flushed.length).toBe(3);
            flushed.forEach((ev, i) => {
                expect((ev.payload as { index: number }).index).toBe(i);
            });
        });

        it('flushFifo drains the queue completely', () => {
            manager.enqueue(makeSessionEvent());
            manager.enqueue(makeSessionEvent());

            const first = manager.flushFifo('session-state');
            const second = manager.flushFifo('session-state');

            expect(first.length).toBe(2);
            expect(second.length).toBe(0);
        });

        it('session-state and stage-snapshot queues are independent', () => {
            manager.enqueue(makeSessionEvent(0));
            manager.enqueue(makeSessionEvent(1));
            manager.enqueue(makeStageEvent(0));

            expect(manager.flushFifo('session-state').length).toBe(2);
            expect(manager.flushFifo('stage-snapshot').length).toBe(1);
        });

        it('enqueue throws for task-progress events', () => {
            expect(() => {
                manager.enqueue(makeTaskEvent(1));
            }).toThrow('[UIEventBufferManager] task-progress must be applied via applyTaskProgress');
        });

        it('enqueue throws for unknown notification type', () => {
            expect(() => {
                manager.enqueue({
                    notificationType: 'unknown' as 'session-state',
                    version: undefined,
                    payload: {},
                    timestamp: Date.now(),
                });
            }).toThrow('[UIEventBufferManager] Unknown notification type');
        });

        it('flushFifo throws for unknown notification type', () => {
            expect(() => {
                manager.flushFifo('unknown' as 'session-state');
            }).toThrow('[UIEventBufferManager] Unknown notification type');
        });
    });

    // -----------------------------------------------------------------------
    // task-progress version gate
    // -----------------------------------------------------------------------

    describe('task-progress version gate', () => {
        it('accepts the first event regardless of version', () => {
            const result = manager.applyTaskProgress(makeTaskEvent(5));
            expect(result).not.toBeUndefined();
            expect(manager.getTaskProgressState().lastAppliedVersion).toBe(5);
        });

        it('accepts strictly increasing versions', () => {
            expect(manager.applyTaskProgress(makeTaskEvent(1))).not.toBeUndefined();
            expect(manager.applyTaskProgress(makeTaskEvent(2))).not.toBeUndefined();
            expect(manager.applyTaskProgress(makeTaskEvent(10))).not.toBeUndefined();
            expect(manager.getTaskProgressState().lastAppliedVersion).toBe(10);
        });

        it('drops equal version (duplicate)', () => {
            manager.applyTaskProgress(makeTaskEvent(5));
            const result = manager.applyTaskProgress(makeTaskEvent(5));
            expect(result).toBeUndefined();
        });

        it('drops lower version (stale)', () => {
            manager.applyTaskProgress(makeTaskEvent(10));
            const result = manager.applyTaskProgress(makeTaskEvent(3));
            expect(result).toBeUndefined();
        });

        it('sets finalReached when value=100 is accepted', () => {
            manager.applyTaskProgress(makeTaskEvent(1, 100));
            expect(manager.getTaskProgressState().finalReached).toBe(true);
        });

        it('drops all events after finalReached', () => {
            manager.applyTaskProgress(makeTaskEvent(1, 100));
            expect(manager.applyTaskProgress(makeTaskEvent(2, 50))).toBeUndefined();
            expect(manager.applyTaskProgress(makeTaskEvent(3, 0))).toBeUndefined();
        });

        it('accepts undefined version unconditionally', () => {
            expect(manager.applyTaskProgress(makeTaskEvent(undefined as unknown as number))).not.toBeUndefined();
            expect(manager.applyTaskProgress(makeTaskEvent(undefined as unknown as number))).not.toBeUndefined();
        });

        it('throws for NaN version', () => {
            expect(() => manager.applyTaskProgress(makeTaskEvent(NaN))).toThrow('Invalid task-progress version');
        });

        it('throws for Infinity version', () => {
            expect(() => manager.applyTaskProgress(makeTaskEvent(Infinity))).toThrow('Invalid task-progress version');
        });

        it('throws for negative version', () => {
            expect(() => manager.applyTaskProgress(makeTaskEvent(-1))).toThrow('Invalid task-progress version');
        });

        it('throws when called with wrong notification type', () => {
            expect(() => {
                manager.applyTaskProgress(makeSessionEvent() as BufferedEvent);
            }).toThrow('[UIEventBufferManager] applyTaskProgress called with wrong type');
        });
    });

    // -----------------------------------------------------------------------
    // reset
    // -----------------------------------------------------------------------

    describe('reset', () => {
        it('clears session-state FIFO queue', () => {
            manager.enqueue(makeSessionEvent());
            manager.enqueue(makeSessionEvent());
            manager.reset();
            expect(manager.flushFifo('session-state').length).toBe(0);
        });

        it('clears stage-snapshot FIFO queue', () => {
            manager.enqueue(makeStageEvent());
            manager.reset();
            expect(manager.flushFifo('stage-snapshot').length).toBe(0);
        });

        it('resets task-progress state', () => {
            manager.applyTaskProgress(makeTaskEvent(5, 100));
            manager.reset();

            const state = manager.getTaskProgressState();
            expect(state.finalReached).toBe(false);
            expect(state.lastAppliedVersion).toBeUndefined();
        });

        it('allows new events after reset', () => {
            manager.enqueue(makeSessionEvent());
            manager.applyTaskProgress(makeTaskEvent(5, 100));
            manager.reset();

            manager.enqueue(makeSessionEvent(99));
            const flushed = manager.flushFifo('session-state');
            expect(flushed.length).toBe(1);
            expect((flushed[0].payload as { index: number }).index).toBe(99);

            const taskResult = manager.applyTaskProgress(makeTaskEvent(1, 50));
            expect(taskResult).not.toBeUndefined();
        });

        it('multiple resets are idempotent', () => {
            manager.enqueue(makeSessionEvent());
            manager.reset();
            manager.reset();
            manager.reset();

            expect(manager.flushFifo('session-state').length).toBe(0);
            const state = manager.getTaskProgressState();
            expect(state.finalReached).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getTaskProgressState immutability
    // -----------------------------------------------------------------------

    describe('getTaskProgressState returns a snapshot', () => {
        it('returned object does not reflect subsequent mutations', () => {
            manager.applyTaskProgress(makeTaskEvent(3));
            const snapshot = manager.getTaskProgressState();

            // Apply more events
            manager.applyTaskProgress(makeTaskEvent(10, 100));

            // Snapshot must not have changed
            expect(snapshot.lastAppliedVersion).toBe(3);
            expect(snapshot.finalReached).toBe(false);
        });
    });
});
