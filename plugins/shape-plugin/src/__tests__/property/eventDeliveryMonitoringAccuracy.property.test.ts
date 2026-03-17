/**
 * Property tests for UI-side event buffer accuracy.
 * session-state and stage-snapshot use FIFO queues — unconditional, arrival order.
 * task-progress uses per-taskId version deduplication via applyTaskProgress().
 * Per build-session-worker-ui-event-spec.md:
 *   "Per-task deduplication: version > lastAppliedVersion[taskId] → accept,
 *    version <= lastAppliedVersion[taskId] → drop."
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
    UIEventBufferManager,
    type BufferedEvent,
} from "../../ui/components/build-progress/eventBufferingUI";

const PROPERTY_TEST_RUNS = 50;
const MAX_EVENTS_PER_TEST = 20;

const makeFifoEvent = (
    notificationType: 'session-state' | 'stage-snapshot',
    index?: number,
): BufferedEvent => ({
    notificationType,
    payload: index !== undefined ? { index } : { test: true },
    timestamp: Date.now(),
});

describe("Property: UIEventBufferManager accuracy", () => {
    let manager: UIEventBufferManager;

    beforeEach(() => {
        manager = new UIEventBufferManager();
    });

    describe("FIFO queue ordering and count — session-state and stage-snapshot", () => {
        it("flushFifo returns all enqueued events in insertion order", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom<'session-state' | 'stage-snapshot'>(
                            "session-state", "stage-snapshot",
                        ),
                        count: fc.integer({ min: 1, max: MAX_EVENTS_PER_TEST }),
                    }),
                    ({ notificationType, count }) => {
                        const mgr = new UIEventBufferManager();
                        const events: BufferedEvent[] = Array.from({ length: count }, (_, i) => ({
                            notificationType,
                            payload: { index: i },
                            timestamp: 1000 + i,
                        }));
                        events.forEach((ev) => mgr.enqueue(ev));
                        const flushed = mgr.flushFifo(notificationType);
                        expect(flushed.length).toBe(count);
                        flushed.forEach((ev, i) => {
                            expect((ev.payload as { index: number }).index).toBe(i);
                        });
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("flushFifo drains the queue — second flush returns empty", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom<'session-state' | 'stage-snapshot'>(
                            "session-state", "stage-snapshot",
                        ),
                        count: fc.integer({ min: 1, max: MAX_EVENTS_PER_TEST }),
                    }),
                    ({ notificationType, count }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < count; i++) mgr.enqueue(makeFifoEvent(notificationType));
                        mgr.flushFifo(notificationType);
                        const second = mgr.flushFifo(notificationType);
                        expect(second.length).toBe(0);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("session-state and stage-snapshot queues are independent", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        sessionCount: fc.integer({ min: 1, max: 10 }),
                        stageCount: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ sessionCount, stageCount }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < sessionCount; i++) mgr.enqueue(makeFifoEvent("session-state"));
                        for (let i = 0; i < stageCount; i++) mgr.enqueue(makeFifoEvent("stage-snapshot"));
                        expect(mgr.flushFifo("session-state").length).toBe(sessionCount);
                        expect(mgr.flushFifo("stage-snapshot").length).toBe(stageCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });

    describe("task-progress: per-taskId version deduplication", () => {
        it("accepts events with strictly increasing versions per taskId", () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: MAX_EVENTS_PER_TEST }),
                    (count) => {
                        const mgr = new UIEventBufferManager();
                        let accepted = 0;
                        for (let i = 1; i <= count; i++) {
                            const result = mgr.applyTaskProgress('task-1', i, { value: i });
                            if (result !== undefined) accepted++;
                        }
                        expect(accepted).toBe(count);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("drops stale versions (version <= last accepted)", () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 2, max: 20 }),
                    (highVersion) => {
                        const mgr = new UIEventBufferManager();
                        // Accept high version first
                        mgr.applyTaskProgress('task-1', highVersion, { value: highVersion });
                        // All lower versions must be dropped
                        let dropped = 0;
                        for (let v = 1; v < highVersion; v++) {
                            const result = mgr.applyTaskProgress('task-1', v, { value: v });
                            if (result === undefined) dropped++;
                        }
                        expect(dropped).toBe(highVersion - 1);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });

    describe("reset clears all state", () => {
        it("reset empties all FIFO queues", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        sessionCount: fc.integer({ min: 1, max: 10 }),
                        stageCount: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ sessionCount, stageCount }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < sessionCount; i++) mgr.enqueue(makeFifoEvent("session-state"));
                        for (let i = 0; i < stageCount; i++) mgr.enqueue(makeFifoEvent("stage-snapshot"));
                        mgr.reset();
                        expect(mgr.flushFifo("session-state").length).toBe(0);
                        expect(mgr.flushFifo("stage-snapshot").length).toBe(0);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("reset clears per-taskId version state", () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 5, max: 20 }),
                    (highVersion) => {
                        const mgr = new UIEventBufferManager();
                        mgr.applyTaskProgress('task-1', highVersion, { value: highVersion });
                        mgr.reset();
                        // After reset, version 1 must be accepted again
                        const result = mgr.applyTaskProgress('task-1', 1, { value: 1 });
                        expect(result).toBeDefined();
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("post-reset activity is independent of pre-reset activity", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        preCount: fc.integer({ min: 1, max: 10 }),
                        postCount: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ preCount, postCount }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < preCount; i++) mgr.enqueue(makeFifoEvent("session-state"));
                        mgr.reset();
                        for (let i = 0; i < postCount; i++) mgr.enqueue(makeFifoEvent("session-state"));
                        expect(mgr.flushFifo("session-state").length).toBe(postCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });
});
