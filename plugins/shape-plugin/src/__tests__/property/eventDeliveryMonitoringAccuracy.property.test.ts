/**
 * Property tests for event delivery monitoring accuracy
 * Tests Property 23 for metrics tracking precision, latency measurement bounds,
 * and buffer utilization reflection accuracy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
    EventDeliveryMonitor,
    type SequencedEvent,
    type NotificationType,
} from '../../worker/api/eventBuffering';
import {
    UIEventBufferManager,
    type SequencedEvent as UISequencedEvent,
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

const createUISequencedEvent = (
    seqNum: number,
    notificationType: NotificationType,
    timestamp?: number,
    payload: unknown = { test: true }
): UISequencedEvent => ({
    seqNum,
    notificationType,
    payload,
    timestamp: timestamp ?? Date.now(),
});

// Property test configurations
const PROPERTY_TEST_RUNS = 50;
const MAX_EVENTS_PER_TEST = 10;
const MAX_LATENCY_MS = 1000;

describe('Property 23: Event Delivery Monitoring Accuracy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock Date.now for consistent timing tests
        vi.useFakeTimers();
        vi.setSystemTime(1000); // Set consistent base time
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Metrics Tracking Precision', () => {
        it('should accurately track emission counts', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            seqNum: fc.integer({ min: 0, max: 50 }),
                            notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        }),
                        { minLength: 1, maxLength: MAX_EVENTS_PER_TEST }
                    ),
                    (events) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        
                        // Track emissions
                        events.forEach((eventData) => {
                            const event = createSequencedEvent(eventData.seqNum, eventData.notificationType);
                            monitor.logEventEmission(event);
                        });

                        // Verify emission count
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsEmitted).toBe(events.length);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should accurately track buffering counts', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            seqNum: fc.integer({ min: 0, max: 50 }),
                            notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            bufferSize: fc.integer({ min: 1, max: 20 }),
                        }),
                        { minLength: 1, maxLength: MAX_EVENTS_PER_TEST }
                    ),
                    (events) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        
                        // Track buffering
                        events.forEach((eventData) => {
                            const event = createSequencedEvent(eventData.seqNum, eventData.notificationType);
                            monitor.logEventBuffering(event, eventData.bufferSize);
                        });

                        // Verify buffering count
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsBuffered).toBe(events.length);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should accurately track processing counts', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            eventCount: fc.integer({ min: 1, max: 5 }),
                            processingStatus: fc.constantFrom('success', 'error'),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    (batches) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        let totalEvents = 0;

                        // Track processing
                        batches.forEach((batch) => {
                            const events = Array.from({ length: batch.eventCount }, (_, i) =>
                                createSequencedEvent(i, 'session-state')
                            );
                            monitor.logEventReception(events, batch.processingStatus);
                            totalEvents += batch.eventCount;
                        });

                        // Verify processing count
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsFlushed).toBe(totalEvents);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Latency Measurement Bounds', () => {
        it('should calculate delivery latencies correctly', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            emissionTime: fc.integer({ min: 1000, max: 2000 }),
                            processingDelay: fc.integer({ min: 0, max: 500 }),
                            eventCount: fc.integer({ min: 1, max: 3 }),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    (scenarios) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        const expectedLatencies: number[] = [];

                        scenarios.forEach((scenario) => {
                            const processingTime = scenario.emissionTime + scenario.processingDelay;
                            
                            // Create events with emission timestamp
                            const events = Array.from({ length: scenario.eventCount }, (_, i) =>
                                createSequencedEvent(i, 'session-state', scenario.emissionTime)
                            );

                            // Set current time to processing time for latency calculation
                            vi.setSystemTime(processingTime);

                            // Log processing (this calculates latencies)
                            monitor.logEventReception(events, 'success');

                            // Track expected latencies
                            events.forEach(() => {
                                expectedLatencies.push(scenario.processingDelay);
                            });
                        });

                        // Verify average latency calculation
                        const metrics = monitor.getMetrics();
                        if (expectedLatencies.length > 0) {
                            const expectedAverageLatency = expectedLatencies.reduce((sum, lat) => sum + lat, 0) / expectedLatencies.length;
                            expect(metrics.averageDeliveryLatency).toBeCloseTo(expectedAverageLatency, 0);

                            // Verify latency bounds
                            expect(metrics.averageDeliveryLatency).toBeGreaterThanOrEqual(0);
                            expect(metrics.averageDeliveryLatency).toBeLessThanOrEqual(MAX_LATENCY_MS);
                        } else {
                            expect(metrics.averageDeliveryLatency).toBe(0);
                        }
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Buffer Utilization Reflection', () => {
        it('should track buffer utilization accurately', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            bufferSize: fc.integer({ min: 0, max: 50 }),
                        }),
                        { minLength: 1, maxLength: MAX_EVENTS_PER_TEST }
                    ),
                    (bufferUpdates) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        const expectedBufferSizes: Record<NotificationType, number> = {
                            'session-state': 0,
                            'stage-snapshot': 0,
                            'task-progress': 0,
                        };

                        // Apply buffer updates
                        bufferUpdates.forEach((update, index) => {
                            const event = createSequencedEvent(index, update.notificationType);
                            monitor.logEventBuffering(event, update.bufferSize);
                            expectedBufferSizes[update.notificationType] = update.bufferSize;
                        });

                        // Verify buffer utilization matches expected state
                        const metrics = monitor.getMetrics();
                        Object.keys(expectedBufferSizes).forEach((type) => {
                            const notificationType = type as NotificationType;
                            expect(metrics.bufferUtilization[notificationType]).toBe(
                                expectedBufferSizes[notificationType]
                            );
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should integrate with UI buffer manager correctly', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            seqNum: fc.integer({ min: 0, max: 20 }),
                        }),
                        { minLength: 1, maxLength: 8 }
                    ),
                    (eventData) => {
                        // Create fresh instances for each test
                        const monitor = new EventDeliveryMonitor();
                        const bufferManager = new UIEventBufferManager();
                        
                        // Buffer events in UI buffer manager and track with monitor
                        eventData.forEach((data) => {
                            const uiEvent = createUISequencedEvent(data.seqNum, data.notificationType);
                            
                            // Buffer in UI manager
                            bufferManager.bufferEvent(uiEvent);
                            
                            // Get actual buffer size after buffering
                            const bufferStatus = bufferManager.getBufferStatus(data.notificationType);
                            
                            // Log with monitor using the actual buffer size
                            const workerEvent = createSequencedEvent(data.seqNum, data.notificationType);
                            monitor.logEventBuffering(workerEvent, bufferStatus.bufferedCount);
                        });

                        // Verify monitor reflects actual buffer sizes
                        const metrics = monitor.getMetrics();
                        (['session-state', 'stage-snapshot', 'task-progress'] as NotificationType[]).forEach((type) => {
                            const bufferStatus = bufferManager.getBufferStatus(type);
                            expect(metrics.bufferUtilization[type]).toBe(bufferStatus.bufferedCount);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Metrics Reset Behavior', () => {
        it('should reset all metrics to initial state', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        emissionCount: fc.integer({ min: 1, max: 10 }),
                        bufferingCount: fc.integer({ min: 1, max: 10 }),
                        processingCount: fc.integer({ min: 1, max: 5 }),
                    }),
                    ({ emissionCount, bufferingCount, processingCount }) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        
                        // Generate some activity
                        for (let i = 0; i < emissionCount; i++) {
                            const event = createSequencedEvent(i, 'session-state');
                            monitor.logEventEmission(event);
                        }

                        for (let i = 0; i < bufferingCount; i++) {
                            const event = createSequencedEvent(i, 'stage-snapshot');
                            monitor.logEventBuffering(event, i + 1);
                        }

                        for (let i = 0; i < processingCount; i++) {
                            const events = [createSequencedEvent(i, 'task-progress')];
                            monitor.logEventReception(events, 'success');
                        }

                        // Verify activity was recorded
                        const metricsBeforeReset = monitor.getMetrics();
                        expect(metricsBeforeReset.totalEventsEmitted).toBeGreaterThan(0);
                        expect(metricsBeforeReset.totalEventsBuffered).toBeGreaterThan(0);
                        expect(metricsBeforeReset.totalEventsFlushed).toBeGreaterThan(0);

                        // Reset metrics
                        monitor.reset();

                        // Verify reset state
                        const metricsAfterReset = monitor.getMetrics();
                        expect(metricsAfterReset.totalEventsEmitted).toBe(0);
                        expect(metricsAfterReset.totalEventsBuffered).toBe(0);
                        expect(metricsAfterReset.totalEventsFlushed).toBe(0);
                        expect(metricsAfterReset.averageDeliveryLatency).toBe(0);
                        expect(metricsAfterReset.lastEmissionTimestamp).toBe(0);
                        expect(metricsAfterReset.lastFlushTimestamp).toBe(0);

                        // Verify buffer utilization reset
                        Object.values(metricsAfterReset.bufferUtilization).forEach((size) => {
                            expect(size).toBe(0);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should maintain metrics independence after reset', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        preResetActivity: fc.integer({ min: 3, max: 8 }),
                        postResetActivity: fc.integer({ min: 1, max: 5 }),
                    }),
                    ({ preResetActivity, postResetActivity }) => {
                        // Create fresh monitor for each test
                        const monitor = new EventDeliveryMonitor();
                        
                        // Pre-reset activity
                        for (let i = 0; i < preResetActivity; i++) {
                            const event = createSequencedEvent(i, 'session-state');
                            monitor.logEventEmission(event);
                        }

                        // Reset
                        monitor.reset();

                        // Post-reset activity
                        for (let i = 0; i < postResetActivity; i++) {
                            const event = createSequencedEvent(i, 'task-progress');
                            monitor.logEventEmission(event);
                        }

                        // Verify only post-reset activity is counted
                        const metrics = monitor.getMetrics();
                        expect(metrics.totalEventsEmitted).toBe(postResetActivity);
                        expect(metrics.totalEventsBuffered).toBe(0);
                        expect(metrics.totalEventsFlushed).toBe(0);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });
});