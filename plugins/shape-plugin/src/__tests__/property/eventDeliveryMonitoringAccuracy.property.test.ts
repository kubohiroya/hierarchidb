/**
 * Property tests for UI-side event buffer accuracy.
 * Replaces the old EventDeliveryMonitor tests (removed in the
 * FIFO+version-gate redesign).  The current UI-side API is:
 *   UIEventBufferManager.enqueue / flushFifo / applyTaskProgress / reset
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
    UIEventBufferManager,
    type BufferedEvent,
    type NotificationType,
} from "../../ui/components/build-progress/eventBufferingUI";

const PROPERTY_TEST_RUNS = 50;
const MAX_EVENTS_PER_TEST = 20;

const makeEvent = (
    notificationType: NotificationType,
    version?: number,
    value?: number,
): BufferedEvent => ({
    notificationType,
    version,
    payload: value !== undefined ? { value } : { test: true },
    timestamp: Date.now(),
});

describe("Property: UIEventBufferManager accuracy", () => {
    let manager: UIEventBufferManager;

    beforeEach(() => {
        manager = new UIEventBufferManager();
    });

    describe("FIFO queue ordering and count", () => {
        it("flushFifo returns all enqueued events in insertion order", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom<"session-state" | "stage-snapshot">(
                            "session-state", "stage-snapshot",
                        ),
                        count: fc.integer({ min: 1, max: MAX_EVENTS_PER_TEST }),
                    }),
                    ({ notificationType, count }) => {
                        const mgr = new UIEventBufferManager();
                        const events: BufferedEvent[] = Array.from({ length: count }, (_, i) => ({
                            notificationType,
                            version: undefined,
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
                        notificationType: fc.constantFrom<"session-state" | "stage-snapshot">(
                            "session-state", "stage-snapshot",
                        ),
                        count: fc.integer({ min: 1, max: MAX_EVENTS_PER_TEST }),
                    }),
                    ({ notificationType, count }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < count; i++) mgr.enqueue(makeEvent(notificationType));
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
                        for (let i = 0; i < sessionCount; i++) mgr.enqueue(makeEvent("session-state"));
                        for (let i = 0; i < stageCount; i++) mgr.enqueue(makeEvent("stage-snapshot"));
                        expect(mgr.flushFifo("session-state").length).toBe(sessionCount);
                        expect(mgr.flushFifo("stage-snapshot").length).toBe(stageCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("enqueue rejects task-progress events", () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 5 }),
                    (count) => {
                        const mgr = new UIEventBufferManager();
                        let errorCount = 0;
                        for (let i = 0; i < count; i++) {
                            try { mgr.enqueue(makeEvent("task-progress")); } catch { errorCount++; }
                        }
                        expect(errorCount).toBe(count);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });

    describe("task-progress version gate", () => {
        it("strictly increasing versions are all accepted", () => {
            fc.assert(
                fc.property(
                    fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: MAX_EVENTS_PER_TEST })
                        .map((arr) => [...new Set(arr)].sort((a, b) => a - b)),
                    (versions) => {
                        if (versions.length < 2) return;
                        const mgr = new UIEventBufferManager();
                        let accepted = 0;
                        for (const v of versions) {
                            if (mgr.applyTaskProgress(makeEvent("task-progress", v, 50)) !== undefined) accepted++;
                        }
                        expect(accepted).toBe(versions.length);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("stale (lower or equal) versions are dropped", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        firstVersion: fc.integer({ min: 10, max: 50 }),
                        staleCount: fc.integer({ min: 1, max: 9 }),
                    }),
                    ({ firstVersion, staleCount }) => {
                        const mgr = new UIEventBufferManager();
                        expect(mgr.applyTaskProgress(makeEvent("task-progress", firstVersion, 50))).not.toBeUndefined();
                        let dropped = 0;
                        for (let i = 0; i < staleCount; i++) {
                            if (mgr.applyTaskProgress(makeEvent("task-progress", firstVersion - i, 50)) === undefined) dropped++;
                        }
                        expect(dropped).toBe(staleCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("events after value=100 (finalReached) are all dropped", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        finalVersion: fc.integer({ min: 1, max: 50 }),
                        afterCount: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ finalVersion, afterCount }) => {
                        const mgr = new UIEventBufferManager();
                        expect(mgr.applyTaskProgress(makeEvent("task-progress", finalVersion, 100))).not.toBeUndefined();
                        expect(mgr.getTaskProgressState().finalReached).toBe(true);
                        let dropped = 0;
                        for (let i = 1; i <= afterCount; i++) {
                            if (mgr.applyTaskProgress(makeEvent("task-progress", finalVersion + i, 50)) === undefined) dropped++;
                        }
                        expect(dropped).toBe(afterCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("undefined version is always accepted", () => {
            fc.assert(
                fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
                    const mgr = new UIEventBufferManager();
                    let accepted = 0;
                    for (let i = 0; i < count; i++) {
                        if (mgr.applyTaskProgress(makeEvent("task-progress", undefined, 50)) !== undefined) accepted++;
                    }
                    expect(accepted).toBe(count);
                }),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });

        it("invalid versions (NaN, Infinity, negative) throw errors", () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.oneof(fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity), fc.integer({ min: -100, max: -1 })),
                        { minLength: 1, maxLength: 5 },
                    ),
                    (invalidVersions) => {
                        let errorCount = 0;
                        for (const v of invalidVersions) {
                            const mgr = new UIEventBufferManager();
                            try {
                                mgr.applyTaskProgress(makeEvent("task-progress", v, 50));
                            } catch (err) {
                                errorCount++;
                                expect(err).toBeInstanceOf(Error);
                                expect((err as Error).message).toContain("Invalid task-progress version");
                            }
                        }
                        expect(errorCount).toBe(invalidVersions.length);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });

    describe("reset clears all state", () => {
        it("reset empties FIFO queues and resets task-progress state", () => {
            fc.assert(
                fc.property(
                    fc.record({
                        sessionCount: fc.integer({ min: 1, max: 10 }),
                        stageCount: fc.integer({ min: 1, max: 10 }),
                        taskVersion: fc.integer({ min: 1, max: 50 }),
                    }),
                    ({ sessionCount, stageCount, taskVersion }) => {
                        const mgr = new UIEventBufferManager();
                        for (let i = 0; i < sessionCount; i++) mgr.enqueue(makeEvent("session-state"));
                        for (let i = 0; i < stageCount; i++) mgr.enqueue(makeEvent("stage-snapshot"));
                        mgr.applyTaskProgress(makeEvent("task-progress", taskVersion, 100));
                        mgr.reset();
                        expect(mgr.flushFifo("session-state").length).toBe(0);
                        expect(mgr.flushFifo("stage-snapshot").length).toBe(0);
                        const state = mgr.getTaskProgressState();
                        expect(state.finalReached).toBe(false);
                        expect(state.lastAppliedVersion).toBeUndefined();
                        expect(mgr.applyTaskProgress(makeEvent("task-progress", 1, 50))).not.toBeUndefined();
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
                        for (let i = 0; i < preCount; i++) mgr.enqueue(makeEvent("session-state"));
                        mgr.reset();
                        for (let i = 0; i < postCount; i++) mgr.enqueue(makeEvent("session-state"));
                        expect(mgr.flushFifo("session-state").length).toBe(postCount);
                    },
                ),
                { numRuns: PROPERTY_TEST_RUNS },
            );
        });
    });
});
