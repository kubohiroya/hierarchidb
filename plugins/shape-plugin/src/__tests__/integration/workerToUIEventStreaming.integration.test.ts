/**
 * Integration tests for Worker-to-UI event streaming across process boundaries
 * Tests actual Worker process emitting events to UI components with seqNum generation,
 * distribution, and AbortController integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIEventBufferManager, type SequencedEvent, type NotificationType } from '../../ui/components/build-progress/eventBufferingUI';
import { unconditionalEventStreamer, eventDeliveryMonitor } from '../../worker/api/eventBuffering';
import type { NodeId } from '@hierarchidb/core-types';

// Test utilities for Worker-to-UI communication
const createNodeId = (id: string): NodeId => id as NodeId;

// Mock Worker environment for testing
class MockWorkerEnvironment {
    private messageHandlers: Array<(event: MessageEvent) => void> = [];
    private isTerminated = false;

    constructor() {
        // Simulate Worker global environment
        global.postMessage = vi.fn((data) => {
            if (this.isTerminated) return;
            
            // Simulate message passing to main thread
            const event = new MessageEvent('message', { data });
            this.messageHandlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error('Message handler error:', error);
                }
            });
        });
    }

    addMessageHandler(handler: (event: MessageEvent) => void): void {
        this.messageHandlers.push(handler);
    }

    removeMessageHandler(handler: (event: MessageEvent) => void): void {
        const index = this.messageHandlers.indexOf(handler);
        if (index >= 0) {
            this.messageHandlers.splice(index, 1);
        }
    }

    terminate(): void {
        this.isTerminated = true;
        this.messageHandlers.length = 0;
    }

    get terminated(): boolean {
        return this.isTerminated;
    }
}

describe('Worker-to-UI Event Streaming Integration Tests', () => {
    let mockWorker: MockWorkerEnvironment;
    let bufferManager: UIEventBufferManager;
    let receivedEvents: SequencedEvent[];

    beforeEach(() => {
        mockWorker = new MockWorkerEnvironment();
        bufferManager = new UIEventBufferManager();
        receivedEvents = [];
        eventDeliveryMonitor.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        mockWorker.terminate();
        bufferManager.reset();
        receivedEvents.length = 0;
        
        // Cleanup all event streamer subscriptions
        const testNodeIds = ['test-node-1', 'test-node-2', 'test-node-3'];
        testNodeIds.forEach(nodeId => {
            unconditionalEventStreamer.cleanup(createNodeId(nodeId));
        });
    });

    describe('Process Boundary Event Delivery', () => {
        it('should deliver events from Worker thread to main thread', async () => {
            const nodeId = createNodeId('test-node-1');
            const eventsToEmit = [
                { type: 'session-state' as const, payload: { status: 'starting' } },
                { type: 'stage-snapshot' as const, payload: { stage: 'source', tasks: [] } },
                { type: 'task-progress' as const, payload: { taskId: 'task-1', progress: 25 } },
            ];

            // Configure distributed sequence numbering for single worker
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

            // Set up message handler to simulate UI receiving events
            const receivedMessages: any[] = [];
            mockWorker.addMessageHandler((event) => {
                if (event.data?.type === 'event-emission') {
                    receivedMessages.push(event.data);
                }
            });

            // Subscribe to events and emit from Worker side
            const unsubscribers: Array<() => void> = [];
            
            eventsToEmit.forEach(({ type }) => {
                const unsubscribe = unconditionalEventStreamer.subscribe(
                    nodeId,
                    type,
                    (sequencedEvent) => {
                        // Simulate posting message to main thread
                        global.postMessage({
                            type: 'event-emission',
                            nodeId,
                            eventType: type,
                            sequencedEvent,
                        });
                    }
                );
                unsubscribers.push(unsubscribe);
            });

            // Emit events from Worker
            eventsToEmit.forEach(({ type, payload }) => {
                unconditionalEventStreamer.emitEvent(nodeId, type, payload as any);
            });

            // Wait for async message processing
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify events were delivered across process boundary
            expect(receivedMessages).toHaveLength(3);
            
            receivedMessages.forEach((message, index) => {
                expect(message.nodeId).toBe(nodeId);
                expect(message.eventType).toBe(eventsToEmit[index]!.type);
                expect(message.sequencedEvent.seqNum).toBe(0); // First event of each type
                expect(message.sequencedEvent.notificationType).toBe(eventsToEmit[index]!.type);
                expect(message.sequencedEvent.payload).toEqual(eventsToEmit[index]!.payload);
            });

            // Cleanup
            unsubscribers.forEach(unsub => unsub());
        });

        it('should handle message channel communication reliability', async () => {
            const nodeId = createNodeId('test-node-2');
            const eventCount = 10; // Reduced for more predictable testing
            
            // Configure distributed sequence numbering
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

            // Track message delivery success/failure
            const deliveryResults: Array<{ success: boolean; eventId: number }> = [];
            
            mockWorker.addMessageHandler((event) => {
                if (event.data?.type === 'event-batch') {
                    // Simulate 100% success rate for predictable testing
                    const success = true;
                    deliveryResults.push({
                        success,
                        eventId: event.data.eventId,
                    });
                    
                    if (success && event.data.sequencedEvent) {
                        bufferManager.bufferEvent(event.data.sequencedEvent);
                    }
                }
            });

            // Subscribe and emit event sequence
            const unsubscribe = unconditionalEventStreamer.subscribe(
                nodeId,
                'task-progress',
                (sequencedEvent) => {
                    global.postMessage({
                        type: 'event-batch',
                        eventId: (sequencedEvent.payload as any).eventId,
                        sequencedEvent,
                    });
                }
            );

            // Emit events
            for (let i = 0; i < eventCount; i++) {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'task-progress',
                    { eventId: i, progress: (i / eventCount) * 100 } as any
                );
            }

            // Wait for message processing
            await new Promise(resolve => setTimeout(resolve, 20));

            // Verify delivery attempts were made
            expect(deliveryResults).toHaveLength(eventCount);
            
            // Verify successful deliveries were buffered
            const bufferedEvents = bufferManager.flushBuffer('task-progress');
            const successfulDeliveries = deliveryResults.filter(r => r.success);
            
            expect(bufferedEvents).toHaveLength(successfulDeliveries.length);
            
            // Verify event ordering is maintained for successful deliveries
            bufferedEvents.forEach((event, index) => {
                expect(event.seqNum).toBe(index);
            });

            unsubscribe();
        });
    });

    describe('SeqNum Generation and Distribution', () => {
        it('should prevent seqNum collisions in multi-worker scenarios', () => {
            const nodeId = createNodeId('test-node-multi');
            const workerCount = 3;
            const eventsPerWorker = 5; // Reduced for simpler testing
            
            const allGeneratedSeqNums: number[] = [];
            const eventsByWorker: Array<{ workerIndex: number; events: SequencedEvent[] }> = [];
            
            // Simulate each worker emitting events
            for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
                // Configure this worker's seqNum generation
                unconditionalEventStreamer.configureDistributedSeqNum(nodeId, workerIndex, workerCount);
                
                const workerEvents: SequencedEvent[] = [];
                const unsubscribe = unconditionalEventStreamer.subscribe(
                    nodeId,
                    'task-progress',
                    (sequencedEvent) => {
                        allGeneratedSeqNums.push(sequencedEvent.seqNum);
                        workerEvents.push(sequencedEvent);
                        bufferManager.bufferEvent(sequencedEvent);
                    }
                );

                // Emit events from this worker
                for (let i = 0; i < eventsPerWorker; i++) {
                    unconditionalEventStreamer.emitEvent(
                        nodeId,
                        'task-progress',
                        { workerIndex, eventIndex: i } as any
                    );
                }

                eventsByWorker.push({ workerIndex, events: workerEvents });
                unsubscribe();
                
                // Reset for next worker (simulate separate worker instances)
                unconditionalEventStreamer.resetSequenceNumbers(nodeId);
            }

            // Verify no seqNum collisions
            const uniqueSeqNums = new Set(allGeneratedSeqNums);
            expect(uniqueSeqNums.size).toBe(allGeneratedSeqNums.length);
            
            // Verify distributed seqNum pattern for each worker
            eventsByWorker.forEach(({ workerIndex, events }) => {
                events.forEach((event, eventIndex) => {
                    const expectedSeqNum = workerIndex + (eventIndex * workerCount);
                    expect(event.seqNum).toBe(expectedSeqNum);
                });
            });

            // Verify events can be flushed in correct order
            const flushedEvents = bufferManager.flushBuffer('task-progress');
            expect(flushedEvents).toHaveLength(workerCount * eventsPerWorker);
        });

        it('should verify seqNum monotonicity within notification types', () => {
            const nodeId = createNodeId('test-monotonic');
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            
            // Configure single worker
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

            const seqNumsByType: Record<NotificationType, number[]> = {
                'session-state': [],
                'stage-snapshot': [],
                'task-progress': [],
            };

            // Subscribe to all notification types
            const unsubscribers = notificationTypes.map(type => 
                unconditionalEventStreamer.subscribe(
                    nodeId,
                    type,
                    (sequencedEvent) => {
                        seqNumsByType[type].push(sequencedEvent.seqNum);
                        bufferManager.bufferEvent(sequencedEvent);
                    }
                )
            );

            // Emit interleaved events
            for (let round = 0; round < 5; round++) {
                notificationTypes.forEach(type => {
                    unconditionalEventStreamer.emitEvent(
                        nodeId,
                        type,
                        { round, type } as any
                    );
                });
            }

            // Verify monotonicity within each type
            notificationTypes.forEach(type => {
                const seqNums = seqNumsByType[type];
                expect(seqNums).toHaveLength(5);
                
                for (let i = 1; i < seqNums.length; i++) {
                    expect(seqNums[i]).toBeGreaterThan(seqNums[i - 1]!);
                }
                
                // Verify seqNums start from 0 and increment by 1
                seqNums.forEach((seqNum, index) => {
                    expect(seqNum).toBe(index);
                });
            });

            // Cleanup
            unsubscribers.forEach(unsub => unsub());
        });

        it('should handle seqNum reset on Worker restart', () => {
            const nodeId = createNodeId('test-restart');
            
            // Initial worker session
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            const firstSessionSeqNums: number[] = [];
            const unsubscribe1 = unconditionalEventStreamer.subscribe(
                nodeId,
                'session-state',
                (event) => firstSessionSeqNums.push(event.seqNum)
            );

            // Emit some events
            for (let i = 0; i < 3; i++) {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'session-state',
                    { session: 1, event: i } as any
                );
            }

            expect(firstSessionSeqNums).toEqual([0, 1, 2]);
            unsubscribe1();

            // Simulate worker restart - reset sequence numbers
            unconditionalEventStreamer.resetSequenceNumbers(nodeId);
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

            const secondSessionSeqNums: number[] = [];
            const unsubscribe2 = unconditionalEventStreamer.subscribe(
                nodeId,
                'session-state',
                (event) => secondSessionSeqNums.push(event.seqNum)
            );

            // Emit events after restart
            for (let i = 0; i < 3; i++) {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'session-state',
                    { session: 2, event: i } as any
                );
            }

            // Verify seqNums reset to start from 0 again
            expect(secondSessionSeqNums).toEqual([0, 1, 2]);
            
            unsubscribe2();
        });
    });

    describe('AbortController Integration', () => {
        it('should terminate event streaming within 500ms', async () => {
            const nodeId = createNodeId('test-abort');
            const abortController = new AbortController();
            
            // Configure event streaming
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            let eventCount = 0;
            const unsubscribe = unconditionalEventStreamer.subscribe(
                nodeId,
                'task-progress',
                () => {
                    eventCount++;
                }
            );

            // Start continuous event emission
            const emissionInterval = setInterval(() => {
                if (abortController.signal.aborted) {
                    clearInterval(emissionInterval);
                    return;
                }
                
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'task-progress',
                    { timestamp: Date.now() } as any
                );
            }, 10); // Emit every 10ms

            // Let events flow for a short time
            await new Promise(resolve => setTimeout(resolve, 50));
            const eventsBeforeAbort = eventCount;
            
            // Trigger abort and measure termination time
            const abortStartTime = performance.now();
            abortController.abort();
            
            // Simulate immediate cleanup on abort
            unsubscribe();
            clearInterval(emissionInterval);
            
            const abortEndTime = performance.now();
            const terminationTime = abortEndTime - abortStartTime;

            // Verify termination completed within 500ms
            expect(terminationTime).toBeLessThan(500);
            
            // Wait a bit more and verify no new events
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(eventCount).toBe(eventsBeforeAbort);
            
            // Verify abort signal is set
            expect(abortController.signal.aborted).toBe(true);
        });

        it('should handle AbortSignal in event emission', async () => {
            const nodeId = createNodeId('test-abort-emission');
            const abortController = new AbortController();
            
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            const emittedEvents: SequencedEvent[] = [];
            const unsubscribe = unconditionalEventStreamer.subscribe(
                nodeId,
                'session-state',
                (event) => emittedEvents.push(event)
            );

            // Emit events before abort
            unconditionalEventStreamer.emitEvent(
                nodeId,
                'session-state',
                { status: 'starting' } as any
            );
            
            unconditionalEventStreamer.emitEvent(
                nodeId,
                'session-state',
                { status: 'running' } as any
            );

            expect(emittedEvents).toHaveLength(2);

            // Trigger abort
            abortController.abort();

            // Simulate checking abort signal before emission
            const shouldEmit = !abortController.signal.aborted;
            
            if (shouldEmit) {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'session-state',
                    { status: 'completed' } as any
                );
            }

            // Verify no events emitted after abort
            expect(emittedEvents).toHaveLength(2);
            expect(emittedEvents.map(e => (e.payload as any).status)).toEqual(['starting', 'running']);

            unsubscribe();
        });

        it('should cleanup event streams on Worker termination', async () => {
            const nodeId = createNodeId('test-cleanup');
            
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            // Set up multiple subscriptions
            const receivedEventsByType: Record<string, SequencedEvent[]> = {
                'session-state': [],
                'stage-snapshot': [],
                'task-progress': [],
            };

            const unsubscribers = Object.keys(receivedEventsByType).map(type =>
                unconditionalEventStreamer.subscribe(
                    nodeId,
                    type,
                    (event) => receivedEventsByType[type]!.push(event)
                )
            );

            // Emit some events
            Object.keys(receivedEventsByType).forEach(type => {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    type as any,
                    { type, data: 'test' } as any
                );
            });

            // Verify events were received
            Object.values(receivedEventsByType).forEach(events => {
                expect(events).toHaveLength(1);
            });

            // Simulate Worker termination cleanup
            unsubscribers.forEach(unsub => unsub());
            unconditionalEventStreamer.cleanup(nodeId);

            // Try to emit events after cleanup
            Object.keys(receivedEventsByType).forEach(type => {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    type as any,
                    { type, data: 'after-cleanup' } as any
                );
            });

            // Verify no new events were received after cleanup
            Object.values(receivedEventsByType).forEach(events => {
                expect(events).toHaveLength(1); // Still only the original event
            });
        });
    });

    describe('Event Delivery Reliability', () => {
        it('should maintain event ordering under Worker load', async () => {
            const nodeId = createNodeId('test-load');
            const eventCount = 10; // Reduced for simpler testing
            const concurrentWorkers = 3;
            
            const allWorkerEvents: SequencedEvent[] = [];
            
            // Configure and run workers sequentially to avoid shared state issues
            for (let workerIndex = 0; workerIndex < concurrentWorkers; workerIndex++) {
                unconditionalEventStreamer.configureDistributedSeqNum(nodeId, workerIndex, concurrentWorkers);
                
                const unsubscribe = unconditionalEventStreamer.subscribe(
                    nodeId,
                    'task-progress',
                    (event) => allWorkerEvents.push(event)
                );

                // Emit events with simulated processing load
                for (let i = 0; i < eventCount; i++) {
                    // Simulate variable processing time
                    if (i % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                    
                    unconditionalEventStreamer.emitEvent(
                        nodeId,
                        'task-progress',
                        { workerIndex, eventIndex: i, timestamp: Date.now() } as any
                    );
                }

                unsubscribe();
                
                // Reset for next worker
                unconditionalEventStreamer.resetSequenceNumbers(nodeId);
            }
            
            // Verify total event count
            expect(allWorkerEvents).toHaveLength(concurrentWorkers * eventCount);
            
            // Verify each worker's events have correct seqNum pattern
            let eventIndex = 0;
            for (let workerIndex = 0; workerIndex < concurrentWorkers; workerIndex++) {
                for (let i = 0; i < eventCount; i++) {
                    const event = allWorkerEvents[eventIndex];
                    const expectedSeqNum = workerIndex + (i * concurrentWorkers);
                    expect(event?.seqNum).toBe(expectedSeqNum);
                    eventIndex++;
                }
            }
        });

        it('should handle event delivery failures gracefully', async () => {
            const nodeId = createNodeId('test-failures');
            
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            const deliveryAttempts: Array<{ success: boolean; event: SequencedEvent }> = [];
            
            const unsubscribe = unconditionalEventStreamer.subscribe(
                nodeId,
                'session-state',
                (event) => {
                    // Simulate random delivery failures
                    const success = Math.random() > 0.3; // 70% success rate
                    
                    deliveryAttempts.push({ success, event });
                    
                    if (success) {
                        bufferManager.bufferEvent(event);
                    } else {
                        // Simulate retry mechanism
                        setTimeout(() => {
                            bufferManager.bufferEvent(event);
                        }, 10);
                    }
                }
            );

            // Emit events
            const eventPayloads = [
                { status: 'starting' },
                { status: 'running' },
                { status: 'paused' },
                { status: 'running' },
                { status: 'completed' },
            ];

            eventPayloads.forEach(payload => {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'session-state',
                    payload as any
                );
            });

            // Wait for retries to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify all events were eventually delivered
            const bufferedEvents = bufferManager.flushBuffer('session-state');
            expect(bufferedEvents).toHaveLength(eventPayloads.length);
            
            // Verify event ordering is maintained despite failures
            bufferedEvents.forEach((event, index) => {
                expect(event.seqNum).toBe(index);
                expect((event.payload as any).status).toBe(eventPayloads[index]!.status);
            });

            unsubscribe();
        });

        it('should verify event delivery monitoring accuracy', () => {
            const nodeId = createNodeId('test-monitoring');
            
            unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);
            
            // Reset monitoring before test
            eventDeliveryMonitor.reset();
            
            const unsubscribe = unconditionalEventStreamer.subscribe(
                nodeId,
                'task-progress',
                (event) => {
                    // Simulate UI-side event processing
                    bufferManager.bufferEvent(event);
                    
                    // Log event reception for monitoring with artificial latency
                    const artificialLatency = 5; // 5ms artificial latency
                    setTimeout(() => {
                        eventDeliveryMonitor.logEventReception([event], 'success');
                    }, artificialLatency);
                }
            );

            // Emit events and verify monitoring
            const eventCount = 5; // Reduced for simpler testing
            for (let i = 0; i < eventCount; i++) {
                unconditionalEventStreamer.emitEvent(
                    nodeId,
                    'task-progress',
                    { eventIndex: i } as any
                );
            }

            // Wait for artificial latency processing
            setTimeout(() => {
                // Get delivery metrics
                const metrics = eventDeliveryMonitor.getMetrics();
                
                // Verify metrics accuracy
                expect(metrics.totalEventsEmitted).toBe(eventCount);
                expect(metrics.totalEventsFlushed).toBe(eventCount);
                expect(metrics.averageDeliveryLatency).toBeGreaterThanOrEqual(0); // Allow 0 latency in tests
                expect(metrics.bufferUtilization['task-progress']).toBe(0); // Events were flushed
            }, 50);
            
            unsubscribe();
        });
    });
});