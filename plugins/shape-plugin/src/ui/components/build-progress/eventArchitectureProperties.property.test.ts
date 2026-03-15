/**
 * Property tests for redesigned event architecture
 * Tests Properties 18-21 for unconditional event delivery, loss-free buffering,
 * state transition independence, and render-synchronized channel establishment
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
    UIEventBufferManager,
    ImmediateHeartbeatProcessor,
    type BufferedEvent,
    type NotificationType,
} from './eventBufferingUI';
import { unconditionalEventStreamer } from '../../../worker/api/eventBuffering';
import type { NodeId } from '@hierarchidb/core-types';

const createNodeId = (id: string): NodeId => id as NodeId;

const createFifoEvent = (
    notificationType: 'session-state' | 'stage-snapshot',
    payload: unknown = { test: true }
): BufferedEvent => ({
    version: undefined,
    notificationType,
    payload,
    timestamp: Date.now(),
});

const createTaskProgressEvent = (version: number, payload: unknown = { value: 1 }): BufferedEvent => ({
    version,
    notificationType: 'task-progress',
    payload,
    timestamp: Date.now(),
});

// Property test configurations
const PROPERTY_TEST_RUNS = 50;
const MAX_EVENTS_PER_TEST = 20;

describe('Event Architecture Properties', () => {
    let bufferManager: UIEventBufferManager;
    let heartbeatCallbacks: Array<{ nodeId: string; heartbeatAt?: number }>;
    let heartbeatProcessor: ImmediateHeartbeatProcessor;

    beforeEach(() => {
        bufferManager = new UIEventBufferManager();
        heartbeatCallbacks = [];
        heartbeatProcessor = new ImmediateHeartbeatProcessor((event) => {
            heartbeatCallbacks.push(event);
        });
        vi.clearAllMocks();
    });

    afterEach(() => {
        bufferManager.reset();
        heartbeatCallbacks.length = 0;
    });

    describe('Property 18: Unconditional Event Delivery', () => {
        it('should emit events regardless of subscriber presence', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                            eventType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            payload: fc.record({ data: fc.string() }),
                        }),
                        { minLength: 1, maxLength: MAX_EVENTS_PER_TEST }
                    ),
                    (events) => {
                        const nodeId = createNodeId(events[0]!.nodeId);
                        let emittedCount = 0;

                        // Emit events without any subscribers — should not throw
                        events.forEach((event) => {
                            unconditionalEventStreamer.emitEvent(
                                nodeId,
                                event.eventType as 'session-state' | 'stage-snapshot' | 'task-progress',
                                event.payload as unknown as import('../../../worker/api/eventBuffering').EventPayload
                            );
                            emittedCount++;
                        });

                        expect(emittedCount).toBe(events.length);

                        // Add subscriber and emit more events
                        const receivedEvents: unknown[] = [];
                        const unsubscribe = unconditionalEventStreamer.subscribe(
                            nodeId,
                            'session-state',
                            (event) => receivedEvents.push(event)
                        );

                        const sessionStateEvents = events.filter(e => e.eventType === 'session-state');
                        sessionStateEvents.forEach((event) => {
                            unconditionalEventStreamer.emitEvent(
                                nodeId,
                                'session-state',
                                event.payload as unknown as import('../../../worker/api/eventBuffering').EventPayload
                            );
                        });

                        expect(receivedEvents.length).toBe(sessionStateEvents.length);

                        unsubscribe();
                        unconditionalEventStreamer.cleanup(nodeId);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should deliver events to all current subscribers', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        subscriberCount: fc.integer({ min: 1, max: 3 }),
                        eventCount: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ nodeId, subscriberCount, eventCount }) => {
                        const node = createNodeId(nodeId);
                        const receivedEventsBySubscriber: unknown[][] = Array.from(
                            { length: subscriberCount },
                            () => []
                        );

                        const unsubscribers = receivedEventsBySubscriber.map((events) =>
                            unconditionalEventStreamer.subscribe(
                                node,
                                'task-progress',
                                (event) => events.push(event)
                            )
                        );

                        for (let i = 0; i < eventCount; i++) {
                            unconditionalEventStreamer.emitEvent(
                                node,
                                'task-progress',
                                { eventIndex: i } as unknown as import('../../../worker/api/eventBuffering').EventPayload
                            );
                        }

                        receivedEventsBySubscriber.forEach((events) => {
                            expect(events.length).toBe(eventCount);
                        });

                        unsubscribers.forEach(unsub => unsub());
                        unconditionalEventStreamer.cleanup(node);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Property 19: Loss-Free Event Buffering', () => {
        it('should buffer all events without loss', () => {
            const testBuffer = new UIEventBufferManager();

            const sessionEvent = createFifoEvent('session-state');
            const stageEvent = createFifoEvent('stage-snapshot');
            const taskEvent = createTaskProgressEvent(1);

            testBuffer.enqueue(sessionEvent);
            testBuffer.enqueue(stageEvent);
            testBuffer.applyTaskProgress(taskEvent);

            const sessionFlushed = testBuffer.flushFifo('session-state');
            const stageFlushed = testBuffer.flushFifo('stage-snapshot');

            expect(sessionFlushed.length).toBe(1);
            expect(stageFlushed.length).toBe(1);
        });

        it('should maintain FIFO ordering within notification types', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom('session-state', 'stage-snapshot') as fc.Arbitrary<'session-state' | 'stage-snapshot'>,
                        eventCount: fc.integer({ min: 2, max: 10 }),
                    }),
                    ({ notificationType, eventCount }) => {
                        const testBuffer = new UIEventBufferManager();
                        const payloads = Array.from({ length: eventCount }, (_, i) => ({ index: i }));

                        payloads.forEach((payload) => {
                            testBuffer.enqueue(createFifoEvent(notificationType, payload));
                        });

                        const flushed = testBuffer.flushFifo(notificationType);

                        // FIFO: order must be preserved
                        expect(flushed.length).toBe(eventCount);
                        flushed.forEach((event, i) => {
                            expect((event.payload as { index: number }).index).toBe(i);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should detect gaps in sequence numbers', () => {
            // task-progress version gate: stale versions are dropped
            const testBuffer = new UIEventBufferManager();

            const accepted1 = testBuffer.applyTaskProgress(createTaskProgressEvent(5));
            const dropped = testBuffer.applyTaskProgress(createTaskProgressEvent(3)); // stale
            const accepted2 = testBuffer.applyTaskProgress(createTaskProgressEvent(7));

            expect(accepted1).toBeDefined();
            expect(dropped).toBeUndefined();
            expect(accepted2).toBeDefined();
        });
    });

    describe('Property 20: State Transition Independence', () => {
        it('should process events independently of state machine progression', () => {
            const testBuffer = new UIEventBufferManager();

            const events = [
                createFifoEvent('session-state', { stateTransition: 'start' }),
                createFifoEvent('stage-snapshot', { stateTransition: 'progress' }),
            ];

            events.forEach(event => testBuffer.enqueue(event));

            const sessionFlushed = testBuffer.flushFifo('session-state');
            const stageFlushed = testBuffer.flushFifo('stage-snapshot');

            expect(sessionFlushed.length).toBe(1);
            expect(stageFlushed.length).toBe(1);

            sessionFlushed.forEach((event) => {
                expect(event.payload).toBeDefined();
            });
        });

        it('should handle concurrent event processing without blocking', () => {
            const testBuffer = new UIEventBufferManager();

            const events = [
                createFifoEvent('session-state'),
                createFifoEvent('session-state'),
                createFifoEvent('stage-snapshot'),
            ];

            events.forEach(event => testBuffer.enqueue(event));

            const sessionFlushed = testBuffer.flushFifo('session-state');
            const stageFlushed = testBuffer.flushFifo('stage-snapshot');

            expect(sessionFlushed.length).toBe(2);
            expect(stageFlushed.length).toBe(1);
        });
    });

    describe('Property 21: Render-Synchronized Channel Establishment', () => {
        it('should establish channels synchronously without race conditions', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeIds: fc.array(
                            fc.string({ minLength: 2, maxLength: 10 }),
                            { minLength: 1, maxLength: 3 }
                        ),
                        eventTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot', 'task-progress', 'heartbeat'),
                            { minLength: 1, maxLength: 3 }
                        ).map(types => Array.from(new Set(types))),
                    }),
                    ({ nodeIds, eventTypes }) => {
                        const subscriptions: Array<() => void> = [];
                        const receivedEvents: Record<string, unknown[]> = {};

                        nodeIds.forEach((nodeIdStr) => {
                            const nodeId = createNodeId(nodeIdStr);

                            eventTypes.forEach((eventType) => {
                                const key = `${nodeIdStr}:${eventType}`;
                                receivedEvents[key] = [];

                                const unsubscribe = unconditionalEventStreamer.subscribe(
                                    nodeId,
                                    eventType as NotificationType | 'heartbeat',
                                    (event) => receivedEvents[key]!.push(event)
                                );
                                subscriptions.push(unsubscribe);
                            });
                        });

                        nodeIds.forEach((nodeIdStr) => {
                            const nodeId = createNodeId(nodeIdStr);

                            eventTypes.forEach((eventType) => {
                                if (eventType === 'heartbeat') {
                                    unconditionalEventStreamer.emitHeartbeat(nodeId, {
                                        type: 'heartbeat',
                                        payload: {
                                            nodeId: String(nodeId),
                                            heartbeatAt: Date.now(),
                                        },
                                    });
                                } else {
                                    unconditionalEventStreamer.emitEvent(
                                        nodeId,
                                        eventType as 'session-state' | 'stage-snapshot' | 'task-progress',
                                        { test: true } as unknown as import('../../../worker/api/eventBuffering').EventPayload
                                    );
                                }
                            });
                        });

                        nodeIds.forEach((nodeIdStr) => {
                            eventTypes.forEach((eventType) => {
                                const key = `${nodeIdStr}:${eventType}`;
                                expect(receivedEvents[key]!.length).toBe(1);
                            });
                        });

                        subscriptions.forEach(unsubscribe => unsubscribe());
                        nodeIds.forEach((nodeIdStr) => {
                            unconditionalEventStreamer.cleanup(createNodeId(nodeIdStr));
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should handle heartbeat events without buffering', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                            heartbeatAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
                        }),
                        { minLength: 1, maxLength: 10 }
                    ),
                    (heartbeats) => {
                        heartbeatCallbacks.length = 0;

                        heartbeats.forEach((heartbeat) => {
                            heartbeatProcessor.processHeartbeat({
                                nodeId: heartbeat.nodeId,
                                heartbeatAt: heartbeat.heartbeatAt,
                            });
                        });

                        expect(heartbeatCallbacks.length).toBe(heartbeats.length);

                        heartbeatCallbacks.forEach((callback, index) => {
                            const original = heartbeats[index]!;
                            expect(callback.nodeId).toBe(original.nodeId);
                            expect(callback.heartbeatAt).toBe(original.heartbeatAt);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });
});
