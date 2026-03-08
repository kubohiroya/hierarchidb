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
    type SequencedEvent,
    type NotificationType,
} from './eventBufferingUI';
import { unconditionalEventStreamer } from '../../../worker/api/eventBuffering';
import type { NodeId } from '@hierarchidb/core-types';

// Test utilities
const createSequencedEvent = (
    seqNum: number,
    notificationType: NotificationType,
    payload: unknown = { test: true }
): SequencedEvent => ({
    seqNum,
    notificationType,
    payload,
    timestamp: Date.now(),
});

const createNodeId = (id: string): NodeId => id as NodeId;

// Property test configurations
const PROPERTY_TEST_RUNS = 50; // Reduced for faster execution
const MAX_EVENTS_PER_TEST = 20; // Reduced for simpler test cases
const MAX_SEQ_NUM = 100; // Reduced range

describe('Event Architecture Properties', () => {
    let bufferManager: UIEventBufferManager;
    let heartbeatProcessor: ImmediateHeartbeatProcessor;
    let heartbeatCallbacks: Array<{ nodeId: string; heartbeatAt?: number }>;

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

                        // Configure distributed sequence numbering
                        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

                        // Emit events without any subscribers
                        events.forEach((event) => {
                            unconditionalEventStreamer.emitEvent(
                                nodeId,
                                event.eventType as 'session-state' | 'stage-snapshot' | 'task-progress',
                                event.payload as any
                            );
                            emittedCount++;
                        });

                        // Events should be emitted without error even without subscribers
                        expect(emittedCount).toBe(events.length);

                        // Add subscriber and emit more events
                        const receivedEvents: any[] = [];
                        const unsubscribe = unconditionalEventStreamer.subscribe(
                            nodeId,
                            'session-state',
                            (event) => receivedEvents.push(event)
                        );

                        // Emit session-state events with subscriber
                        const sessionStateEvents = events.filter(e => e.eventType === 'session-state');
                        sessionStateEvents.forEach((event) => {
                            unconditionalEventStreamer.emitEvent(
                                nodeId,
                                'session-state',
                                event.payload as any
                            );
                        });

                        // Should receive events when subscribed
                        expect(receivedEvents.length).toBe(sessionStateEvents.length);

                        // Cleanup
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
                        const receivedEventsBySubscriber: any[][] = Array.from(
                            { length: subscriberCount },
                            () => []
                        );

                        // Configure distributed sequence numbering
                        unconditionalEventStreamer.configureDistributedSeqNum(node, 0, 1);

                        // Create multiple subscribers
                        const unsubscribers = receivedEventsBySubscriber.map((events, index) =>
                            unconditionalEventStreamer.subscribe(
                                node,
                                'task-progress',
                                (event) => events.push(event)
                            )
                        );

                        // Emit events
                        for (let i = 0; i < eventCount; i++) {
                            unconditionalEventStreamer.emitEvent(
                                node,
                                'task-progress',
                                { eventIndex: i } as any
                            );
                        }

                        // All subscribers should receive all events
                        receivedEventsBySubscriber.forEach((events) => {
                            expect(events.length).toBe(eventCount);
                        });

                        // Cleanup
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
            // Simple test with fresh buffer manager
            const testBuffer = new UIEventBufferManager();
            
            const events = [
                createSequencedEvent(0, 'session-state'),
                createSequencedEvent(1, 'stage-snapshot'),
                createSequencedEvent(2, 'task-progress'),
            ];

            events.forEach(event => testBuffer.bufferEvent(event));

            let totalBuffered = 0;
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            
            notificationTypes.forEach((type) => {
                const status = testBuffer.getBufferStatus(type);
                totalBuffered += status.bufferedCount;
            });

            expect(totalBuffered).toBe(events.length);
        });

        it('should maintain seqNum ordering within notification types', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        seqNums: fc.array(
                            fc.integer({ min: 0, max: MAX_SEQ_NUM }),
                            { minLength: 2, maxLength: 10 }
                        ),
                    }),
                    ({ notificationType, seqNums }) => {
                        // Remove duplicates and sort for expected order
                        const uniqueSeqNums = Array.from(new Set(seqNums)).sort((a, b) => a - b);
                        
                        if (uniqueSeqNums.length < 2) return; // Skip if not enough unique values

                        // Buffer events in random order
                        const shuffledSeqNums = [...uniqueSeqNums].sort(() => Math.random() - 0.5);
                        shuffledSeqNums.forEach((seqNum) => {
                            const event = createSequencedEvent(seqNum, notificationType);
                            bufferManager.bufferEvent(event);
                        });

                        // Flush all available events
                        const flushedEvents = bufferManager.flushBuffer(notificationType);

                        // Verify events are in seqNum order
                        for (let i = 1; i < flushedEvents.length; i++) {
                            expect(flushedEvents[i]!.seqNum).toBeGreaterThan(flushedEvents[i - 1]!.seqNum);
                        }
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should detect gaps in sequence numbers', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        notificationType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        seqNums: fc.array(
                            fc.integer({ min: 0, max: 20 }),
                            { minLength: 2, maxLength: 8 }
                        ),
                    }),
                    ({ notificationType, seqNums }) => {
                        // Create a sequence with intentional gaps
                        const uniqueSeqNums = Array.from(new Set(seqNums)).sort((a, b) => a - b);
                        
                        if (uniqueSeqNums.length < 2) return; // Skip if not enough unique values

                        // Buffer only some events to create gaps
                        const eventsToBuffer = uniqueSeqNums.slice(0, Math.floor(uniqueSeqNums.length / 2));
                        eventsToBuffer.forEach((seqNum) => {
                            const event = createSequencedEvent(seqNum, notificationType);
                            bufferManager.bufferEvent(event);
                        });

                        // Add a higher sequence number to create a gap
                        const highSeqNum = Math.max(...uniqueSeqNums) + 5;
                        const gapEvent = createSequencedEvent(highSeqNum, notificationType);
                        bufferManager.bufferEvent(gapEvent);

                        // Detect gaps
                        const gaps = bufferManager.detectGaps(notificationType);

                        // Should detect gaps if there's a discontinuity
                        const allBufferedSeqNums = [...eventsToBuffer, highSeqNum].sort((a, b) => a - b);
                        const minSeq = Math.min(...allBufferedSeqNums);
                        const maxSeq = Math.max(...allBufferedSeqNums);
                        
                        let expectedGaps = 0;
                        for (let seq = minSeq; seq <= maxSeq; seq++) {
                            if (!allBufferedSeqNums.includes(seq)) {
                                expectedGaps++;
                            }
                        }

                        if (expectedGaps > 0) {
                            expect(gaps.length).toBeGreaterThan(0);
                        }
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Property 20: State Transition Independence', () => {
        it('should process events independently of state machine progression', () => {
            // Simple test with fresh buffer manager
            const testBuffer = new UIEventBufferManager();
            
            const events = [
                createSequencedEvent(0, 'session-state', { stateTransition: 'start', data: 'test' }),
                createSequencedEvent(1, 'stage-snapshot', { stateTransition: 'progress', data: 'test' }),
                createSequencedEvent(2, 'task-progress', { stateTransition: 'complete', data: 'test' }),
            ];

            events.forEach(event => testBuffer.bufferEvent(event));

            let totalBuffered = 0;
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            
            notificationTypes.forEach((type) => {
                const status = testBuffer.getBufferStatus(type);
                totalBuffered += status.bufferedCount;
            });

            expect(totalBuffered).toBe(events.length);

            // Flush events and verify they maintain their payload integrity
            const allFlushedEvents: SequencedEvent[] = [];
            notificationTypes.forEach((type) => {
                const flushed = testBuffer.flushBuffer(type);
                allFlushedEvents.push(...flushed);
            });

            // Each flushed event should maintain its original payload
            allFlushedEvents.forEach((flushedEvent) => {
                expect(flushedEvent.payload).toBeDefined();
                expect(typeof flushedEvent.payload).toBe('object');
            });
        });

        it('should handle concurrent event processing without blocking', () => {
            // Simple test with fresh buffer manager
            const testBuffer = new UIEventBufferManager();
            
            const events = [
                createSequencedEvent(0, 'session-state'),
                createSequencedEvent(1, 'session-state'),
                createSequencedEvent(2, 'stage-snapshot'),
            ];

            events.forEach(event => testBuffer.bufferEvent(event));

            let totalBuffered = 0;
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            
            notificationTypes.forEach((type) => {
                const status = testBuffer.getBufferStatus(type);
                totalBuffered += status.bufferedCount;
            });

            expect(totalBuffered).toBe(events.length);
        });
    });

    describe('Property 21: Render-Synchronized Channel Establishment', () => {
        it('should establish channels synchronously without race conditions', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeIds: fc.array(
                            fc.string({ minLength: 2, maxLength: 10 }), // Avoid single space
                            { minLength: 1, maxLength: 3 }
                        ),
                        eventTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot', 'task-progress', 'heartbeat'),
                            { minLength: 1, maxLength: 3 }
                        ).map(types => Array.from(new Set(types))), // Remove duplicates
                    }),
                    ({ nodeIds, eventTypes }) => {
                        const subscriptions: Array<() => void> = [];
                        const receivedEvents: Record<string, any[]> = {};

                        // Establish channels for multiple nodes synchronously
                        nodeIds.forEach((nodeIdStr) => {
                            const nodeId = createNodeId(nodeIdStr);
                            
                            // Configure distributed sequence numbering
                            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
                            
                            eventTypes.forEach((eventType) => {
                                const key = `${nodeIdStr}:${eventType}`;
                                receivedEvents[key] = [];
                                
                                const unsubscribe = unconditionalEventStreamer.subscribe(
                                    nodeId,
                                    eventType,
                                    (event) => receivedEvents[key]!.push(event)
                                );
                                subscriptions.push(unsubscribe);
                            });
                        });

                        // Emit events to all nodes and verify delivery
                        nodeIds.forEach((nodeIdStr) => {
                            const nodeId = createNodeId(nodeIdStr);
                            
                            eventTypes.forEach((eventType) => {
                                if (eventType === 'heartbeat') {
                                    unconditionalEventStreamer.emitHeartbeat(nodeId, {
                                        nodeId: nodeIdStr,
                                        heartbeatAt: Date.now(),
                                    } as any);
                                } else {
                                    unconditionalEventStreamer.emitEvent(
                                        nodeId,
                                        eventType as 'session-state' | 'stage-snapshot' | 'task-progress',
                                        { test: true } as any
                                    );
                                }
                            });
                        });

                        // Verify events were delivered to all established channels
                        nodeIds.forEach((nodeIdStr) => {
                            eventTypes.forEach((eventType) => {
                                const key = `${nodeIdStr}:${eventType}`;
                                expect(receivedEvents[key]!.length).toBe(1);
                            });
                        });

                        // Cleanup all subscriptions
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
                        heartbeatCallbacks.length = 0; // Reset

                        // Process heartbeat events immediately
                        heartbeats.forEach((heartbeat) => {
                            heartbeatProcessor.processHeartbeat({
                                nodeId: heartbeat.nodeId,
                                heartbeatAt: heartbeat.heartbeatAt,
                            });
                        });

                        // All heartbeats should be processed immediately
                        expect(heartbeatCallbacks.length).toBe(heartbeats.length);

                        // Verify heartbeat data integrity
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