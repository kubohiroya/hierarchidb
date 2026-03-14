/**
 * Extended property tests for event delivery system
 * Tests Property 24-27 for parallel processing, error conditions, performance, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
    EventDeliveryMonitor,
    unconditionalEventStreamer,
    type SequencedEvent,
    type NotificationType,
} from '../../worker/api/eventBuffering';
import {
    UIEventBufferManager,
    type BufferedEvent,
} from '../../ui/components/build-progress/eventBufferingUI';

// Test utilities
const createSequencedEvent = (
    seqNum: number,
    notificationType: NotificationType,
    timestamp?: number,
    payload: unknown = { test: true }
): SequencedEvent => ({
    seqNum,
    notificationType,
    payload,
    timestamp: timestamp ?? Date.now(),
});

const createUIBufferedEvent = (
    notificationType: NotificationType,
    timestamp?: number,
    payload: unknown = { test: true },
    version?: number
): BufferedEvent => ({
    version,
    notificationType,
    payload,
    timestamp: timestamp ?? Date.now(),
});

// Property test configurations
const PROPERTY_TEST_RUNS = 50;
const MAX_PARALLEL_WORKERS = 5;
const PERFORMANCE_EVENT_COUNT = 100;

describe('Property 24-27: Extended Event Delivery Scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(1000);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Property 24: Parallel Processing Scenarios', () => {
        it('should handle concurrent event streams correctly', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        workerCount: fc.integer({ min: 2, max: MAX_PARALLEL_WORKERS }),
                        eventsPerWorker: fc.integer({ min: 1, max: 10 }),
                        notificationTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot'),
                            { minLength: 1, maxLength: 2 }
                        ),
                    }),
                    ({ workerCount, eventsPerWorker, notificationTypes }) => {
                        const monitor = new EventDeliveryMonitor();
                        const bufferManager = new UIEventBufferManager();

                        // Simulate parallel workers emitting events
                        const allEvents: SequencedEvent[] = [];

                        for (let workerId = 0; workerId < workerCount; workerId++) {
                            for (let eventIdx = 0; eventIdx < eventsPerWorker; eventIdx++) {
                                notificationTypes.forEach((notificationType) => {
                                    // Generate distributed sequence numbers
                                    const seqNum = workerId + (eventIdx * workerCount);
                                    const event = createSequencedEvent(seqNum, notificationType);

                                    // Log emission
                                    monitor.logEventEmission(event);

                                    // Enqueue into FIFO (session-state / stage-snapshot only)
                                    const uiEvent = createUIBufferedEvent(notificationType as 'session-state' | 'stage-snapshot');
                                    bufferManager.enqueue(uiEvent);

                                    // Log buffering with size=1 per event
                                    monitor.logEventBuffering(event, 1);

                                    allEvents.push(event);
                                });
                            }
                        }

                        // Process all events
                        monitor.logEventReception(allEvents, 'success');

                        // Verify metrics consistency
                        const metrics = monitor.getMetrics();
                        const expectedEmissions = workerCount * eventsPerWorker * notificationTypes.length;

                        expect(metrics.totalEventsEmitted).toBe(expectedEmissions);
                        expect(metrics.totalEventsBuffered).toBe(expectedEmissions);
                        expect(metrics.totalEventsFlushed).toBe(expectedEmissions);

                        // Verify FIFO queues can be drained without error
                        notificationTypes.forEach((type) => {
                            const flushed = bufferManager.flushFifo(type as 'session-state' | 'stage-snapshot');
                            expect(Array.isArray(flushed)).toBe(true);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should maintain sequence number monotonicity across workers', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        totalWorkers: fc.integer({ min: 2, max: MAX_PARALLEL_WORKERS }),
                        eventsPerWorker: fc.integer({ min: 3, max: 8 }),
                    }),
                    ({ totalWorkers, eventsPerWorker }) => {
                        const monitor = new EventDeliveryMonitor();
                        const generatedSeqNums: number[] = [];

                        // Simulate distributed sequence number generation
                        for (let workerId = 0; workerId < totalWorkers; workerId++) {
                            for (let eventCount = 0; eventCount < eventsPerWorker; eventCount++) {
                                const seqNum = workerId + (eventCount * totalWorkers);
                                const event = createSequencedEvent(seqNum, 'session-state');

                                monitor.logEventEmission(event);
                                generatedSeqNums.push(seqNum);
                            }
                        }

                        // Verify no duplicates
                        const uniqueSeqNums = new Set(generatedSeqNums);
                        expect(uniqueSeqNums.size).toBe(generatedSeqNums.length);

                        // Verify proper distribution
                        const sortedSeqNums = [...generatedSeqNums].sort((a, b) => a - b);
                        for (let i = 1; i < sortedSeqNums.length; i++) {
                            expect(sortedSeqNums[i]).toBeGreaterThan(sortedSeqNums[i - 1]);
                        }
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Property 25: Error Condition Handling', () => {
        it('should handle processing errors gracefully', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        successfulEvents: fc.integer({ min: 1, max: 10 }),
                        failedEvents: fc.integer({ min: 1, max: 5 }),
                        errorTypes: fc.array(
                            fc.constantFrom('network', 'parsing', 'validation', 'timeout'),
                            { minLength: 1, maxLength: 2 }
                        ),
                    }),
                    ({ successfulEvents, failedEvents, errorTypes }) => {
                        const monitor = new EventDeliveryMonitor();

                        // Process successful events
                        const successEvents = Array.from({ length: successfulEvents }, (_, i) =>
                            createSequencedEvent(i, 'session-state')
                        );
                        monitor.logEventReception(successEvents, 'success');

                        // Process failed events with different error types
                        errorTypes.forEach((errorType, typeIndex) => {
                            const errorEvents = Array.from({ length: failedEvents }, (_, i) =>
                                createSequencedEvent(successfulEvents + typeIndex * failedEvents + i, 'task-progress')
                            );

                            const error = new Error(`${errorType} error occurred`);
                            monitor.logEventReception(errorEvents, 'error', error);
                        });

                        // Verify metrics account for all events
                        const metrics = monitor.getMetrics();
                        const expectedTotal = successfulEvents + (failedEvents * errorTypes.length);

                        expect(metrics.totalEventsFlushed).toBe(expectedTotal);
                        expect(metrics.averageDeliveryLatency).toBeGreaterThanOrEqual(0);

                        // Memory usage should be within bounds even with errors
                        expect(metrics.memoryUsage.latencyEntriesCount).toBe(expectedTotal);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should isolate subscriber exceptions', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        subscriberCount: fc.integer({ min: 2, max: 5 }),
                        failingSubscriberIndex: fc.integer({ min: 0, max: 4 }),
                        eventCount: fc.integer({ min: 1, max: 5 }),
                    }),
                    ({ subscriberCount, failingSubscriberIndex, eventCount }) => {
                        const nodeId = 'test-node';
                        const callbackResults: boolean[] = [];

                        // Set up multiple subscribers
                        const unsubscribeFunctions: (() => void)[] = [];

                        for (let i = 0; i < subscriberCount; i++) {
                            const shouldFail = i === failingSubscriberIndex % subscriberCount;

                            const callback = (_event: SequencedEvent) => {
                                if (shouldFail) {
                                    callbackResults.push(false);
                                    throw new Error(`Subscriber ${i} failed`);
                                } else {
                                    callbackResults.push(true);
                                }
                            };

                            const unsubscribe = unconditionalEventStreamer.subscribe(nodeId, 'session-state', callback);
                            unsubscribeFunctions.push(unsubscribe);
                        }

                        // Emit events
                        for (let i = 0; i < eventCount; i++) {
                            unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
                                nodeId,
                                sessionId: 'test-session',
                                state: 'running',
                            });
                        }

                        // Verify that non-failing subscribers still received events
                        const successfulCalls = callbackResults.filter(result => result === true);
                        const expectedSuccessfulCalls = (subscriberCount - 1) * eventCount;

                        expect(successfulCalls.length).toBe(expectedSuccessfulCalls);

                        // Cleanup
                        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Property 26: Performance Under Load', () => {
        it('should maintain performance with large event volumes', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        batchSize: fc.integer({ min: 50, max: PERFORMANCE_EVENT_COUNT }),
                        batchCount: fc.integer({ min: 2, max: 5 }),
                    }),
                    ({ batchSize, batchCount }) => {
                        const monitor = new EventDeliveryMonitor({
                            maxLatencyEntries: 2000,
                            cleanupThreshold: 1500,
                        });

                        const _startTime = Date.now();

                        // Process multiple batches
                        for (let batch = 0; batch < batchCount; batch++) {
                            const events = Array.from({ length: batchSize }, (_, i) =>
                                createSequencedEvent(batch * batchSize + i, 'session-state')
                            );

                            // Simulate processing time
                            vi.advanceTimersByTime(10);

                            monitor.logEventReception(events, 'success');
                        }

                        const _endTime = Date.now();
                        const totalEvents = batchSize * batchCount;

                        // Verify all events were processed
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsFlushed).toBe(totalEvents);

                        // Verify memory management kicked in if needed
                        if (totalEvents > 1500) {
                            expect(metrics.memoryUsage.latencyEntriesCount).toBeLessThanOrEqual(1500);
                        }

                        // Verify latency calculation is reasonable
                        expect(metrics.averageDeliveryLatency).toBeGreaterThanOrEqual(0);
                        expect(metrics.averageDeliveryLatency).toBeLessThan(1000); // Should be reasonable
                    }
                ),
                { numRuns: 20 } // Fewer runs for performance tests
            );
        });

        it('should handle rapid successive task-progress events efficiently', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 10, max: 50 }),
                    (eventCount) => {
                        const monitor = new EventDeliveryMonitor();
                        const bufferManager = new UIEventBufferManager();

                        // Emit task-progress events with increasing versions
                        let acceptedCount = 0;
                        for (let i = 0; i < eventCount; i++) {
                            const event = createSequencedEvent(i, 'task-progress');
                            monitor.logEventEmission(event);

                            // task-progress uses version-based gate
                            const uiEvent = createUIBufferedEvent('task-progress', undefined, { value: i }, i);
                            const accepted = bufferManager.applyTaskProgress(uiEvent);
                            if (accepted !== undefined) {
                                acceptedCount++;
                                monitor.logEventBuffering(event, acceptedCount);
                            }

                            // Advance time slightly
                            vi.advanceTimersByTime(1);
                        }

                        // Process all emitted events
                        const allEvents = Array.from({ length: eventCount }, (_, i) =>
                            createSequencedEvent(i, 'task-progress')
                        );
                        monitor.logEventReception(allEvents, 'success');

                        // Verify emission count
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsEmitted).toBe(eventCount);
                        expect(metrics.totalEventsFlushed).toBe(eventCount);

                        // All events with increasing versions should be accepted
                        expect(acceptedCount).toBe(eventCount);
                    }
                ),
                { numRuns: 20 } // Fewer runs for performance tests
            );
        });
    });

    describe('Property 27: Edge Cases and Invalid Data', () => {
        it('should reject invalid task-progress versions', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            version: fc.oneof(
                                fc.constant(NaN),
                                fc.constant(Infinity),
                                fc.constant(-Infinity),
                                fc.integer({ min: -100, max: -1 }),
                            ),
                            notificationType: fc.constant('task-progress' as const),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    (invalidEvents) => {
                        const bufferManager = new UIEventBufferManager();
                        let errorCount = 0;

                        invalidEvents.forEach((eventData) => {
                            try {
                                const event = createUIBufferedEvent(
                                    eventData.notificationType,
                                    undefined,
                                    { test: true },
                                    eventData.version
                                );
                                bufferManager.applyTaskProgress(event);
                            } catch (error) {
                                errorCount++;
                                expect(error).toBeInstanceOf(Error);
                                expect((error as Error).message).toContain('Invalid task-progress version');
                            }
                        });

                        // All invalid versions must throw
                        expect(errorCount).toBe(invalidEvents.length);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should handle empty event arrays', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('success', 'error'),
                    (processingStatus) => {
                        const monitor = new EventDeliveryMonitor();

                        // Process empty array
                        monitor.logEventReception([], processingStatus);

                        // Verify metrics are updated correctly
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsFlushed).toBe(0);
                        expect(metrics.averageDeliveryLatency).toBe(0);
                        expect(metrics.memoryUsage.latencyEntriesCount).toBe(0);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should handle malformed event payloads', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            seqNum: fc.integer({ min: 0, max: 100 }),
                            notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            payload: fc.oneof(
                                fc.constant(null),
                                fc.constant(undefined),
                                fc.string(),
                                fc.integer(),
                                fc.object(),
                                fc.array(fc.anything())
                            ),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    (eventData) => {
                        const monitor = new EventDeliveryMonitor();

                        // Create events with various payload types
                        const events = eventData.map((data) => ({
                            seqNum: data.seqNum,
                            notificationType: data.notificationType,
                            payload: data.payload,
                            timestamp: Date.now(),
                        }));

                        // Should not throw errors regardless of payload content
                        expect(() => {
                            monitor.logEventReception(events, 'success');
                        }).not.toThrow();

                        // Verify metrics are still accurate
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsFlushed).toBe(events.length);
                        expect(metrics.memoryUsage.latencyEntriesCount).toBe(events.length);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should handle extreme timestamp values', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            seqNum: fc.integer({ min: 0, max: 50 }),
                            timestamp: fc.oneof(
                                fc.constant(0), // Unix epoch
                                fc.constant(Date.now() + 86400000), // Future timestamp
                                fc.constant(Date.now() - 86400000), // Past timestamp
                                fc.integer({ min: 1, max: 1000 }), // Very old timestamp
                                fc.integer({ min: Date.now(), max: Date.now() + 31536000000 }) // Far future
                            ),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    (eventData) => {
                        const monitor = new EventDeliveryMonitor();

                        const events = eventData.map((data) =>
                            createSequencedEvent(data.seqNum, 'session-state', data.timestamp)
                        );

                        // Should handle extreme timestamps without errors
                        expect(() => {
                            monitor.logEventReception(events, 'success');
                        }).not.toThrow();

                        // Verify latency calculation handles extreme values
                        const metrics = monitor.getMetrics();
                        expect(Number.isFinite(metrics.averageDeliveryLatency)).toBe(true);
                        expect(metrics.totalEventsFlushed).toBe(events.length);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });
});
