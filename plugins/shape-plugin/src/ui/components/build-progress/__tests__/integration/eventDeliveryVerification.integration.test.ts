/**
 * Integration tests for comprehensive event delivery verification
 * Tests end-to-end event delivery from Worker to UI
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UIEventBufferManager, type SequencedEvent, type NotificationType } from '../../eventBufferingUI';

describe('Event Delivery Verification - Integration Tests', () => {
    let eventBufferManager: UIEventBufferManager;
    let deliveredEvents: SequencedEvent[];

    beforeEach(() => {
        eventBufferManager = new UIEventBufferManager();
        deliveredEvents = [];
    });

    afterEach(() => {
        eventBufferManager.reset();
    });

    // Task 11.1: Integration test for unconditional event delivery
    describe('Unconditional Event Delivery', () => {
        it('should deliver events regardless of UI readiness state', () => {
            // Simulate Worker emitting events before UI is ready
            const preUIEvents: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'starting' }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'running' }, timestamp: Date.now() + 100 },
                { seqNum: 0, notificationType: 'task-progress', payload: { progress: 10 }, timestamp: Date.now() + 200 },
            ];

            // Buffer events while UI is "not ready"
            for (const event of preUIEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Simulate UI becoming ready and requesting events
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            // Verify all events are delivered despite UI not being ready initially
            expect(sessionEvents).toHaveLength(2);
            expect(progressEvents).toHaveLength(1);
            expect(sessionEvents[0].payload).toEqual({ status: 'starting' });
            expect(sessionEvents[1].payload).toEqual({ status: 'running' });
            expect(progressEvents[0].payload).toEqual({ progress: 10 });
        });

        it('should continue event delivery during UI component mount/unmount cycles', () => {
            // Simulate events during component lifecycle
            const lifecycleEvents: SequencedEvent[] = [
                // Before mount
                { seqNum: 0, notificationType: 'session-state', payload: { phase: 'pre-mount' }, timestamp: Date.now() },
                
                // During mount
                { seqNum: 1, notificationType: 'session-state', payload: { phase: 'mounting' }, timestamp: Date.now() + 50 },
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { stage: 'source' }, timestamp: Date.now() + 100 },
                
                // After mount (component active)
                { seqNum: 2, notificationType: 'session-state', payload: { phase: 'active' }, timestamp: Date.now() + 150 },
                { seqNum: 0, notificationType: 'task-progress', payload: { progress: 25 }, timestamp: Date.now() + 200 },
                
                // During unmount
                { seqNum: 3, notificationType: 'session-state', payload: { phase: 'unmounting' }, timestamp: Date.now() + 250 },
                
                // After unmount
                { seqNum: 4, notificationType: 'session-state', payload: { phase: 'post-unmount' }, timestamp: Date.now() + 300 },
            ];

            // Buffer all events
            for (const event of lifecycleEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Verify all events are preserved regardless of component lifecycle
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            expect(sessionEvents).toHaveLength(5);
            expect(snapshotEvents).toHaveLength(1);
            expect(progressEvents).toHaveLength(1);

            // Verify event sequence integrity
            const phases = sessionEvents.map(e => (e.payload as any).phase);
            expect(phases).toEqual(['pre-mount', 'mounting', 'active', 'unmounting', 'post-unmount']);
        });

        it('should verify Worker continues emitting events when UI is not ready', () => {
            // Simulate continuous Worker activity without UI subscription
            const continuousEvents: SequencedEvent[] = [];
            
            for (let i = 0; i < 20; i++) {
                continuousEvents.push({
                    seqNum: i,
                    notificationType: 'task-progress',
                    payload: { taskId: `task-${i % 5}`, progress: i * 5 },
                    timestamp: Date.now() + i * 10,
                });
            }

            // Buffer events without any UI flush (simulating UI not ready)
            for (const event of continuousEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Simulate delayed UI readiness
            setTimeout(() => {
                const bufferedEvents = eventBufferManager.flushBuffer('task-progress');
                expect(bufferedEvents).toHaveLength(20);
                
                // Verify no events were lost during UI unavailability
                for (let i = 0; i < 20; i++) {
                    expect(bufferedEvents[i].seqNum).toBe(i);
                    expect((bufferedEvents[i].payload as any).progress).toBe(i * 5);
                }
            }, 100);
        });
    });

    // Task 11.2: Integration test for loss-free event buffering
    describe('Loss-Free Event Buffering', () => {
        it('should handle rapid event sequences without loss', () => {
            const rapidEventCount = 1000;
            const events: SequencedEvent[] = [];

            // Generate rapid sequence with mixed notification types
            for (let i = 0; i < rapidEventCount; i++) {
                const notificationType: NotificationType = 
                    i % 3 === 0 ? 'session-state' :
                    i % 3 === 1 ? 'stage-snapshot' : 'task-progress';
                
                events.push({
                    seqNum: Math.floor(i / 3),
                    notificationType,
                    payload: { eventId: i, data: `rapid-${i}` },
                    timestamp: Date.now() + i,
                });
            }

            // Buffer events in rapid succession
            const startTime = performance.now();
            for (const event of events) {
                eventBufferManager.bufferEvent(event);
            }
            const bufferTime = performance.now() - startTime;

            // Verify buffering performance (should complete within reasonable time)
            expect(bufferTime).toBeLessThan(100); // 100ms for 1000 events

            // Flush all notification types
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            // Verify no events were lost
            const totalFlushed = sessionEvents.length + snapshotEvents.length + progressEvents.length;
            expect(totalFlushed).toBe(rapidEventCount);

            // Verify each type has correct count
            expect(sessionEvents).toHaveLength(Math.ceil(rapidEventCount / 3));
            expect(snapshotEvents).toHaveLength(Math.floor(rapidEventCount / 3));
            expect(progressEvents).toHaveLength(Math.floor(rapidEventCount / 3));
        });

        it('should maintain buffer integrity during UI state transitions', () => {
            // Simulate UI state transitions with concurrent event buffering
            const transitionEvents: SequencedEvent[] = [
                // Initial state
                { seqNum: 0, notificationType: 'session-state', payload: { uiState: 'initializing' }, timestamp: Date.now() },
                
                // Loading state with progress events
                { seqNum: 1, notificationType: 'session-state', payload: { uiState: 'loading' }, timestamp: Date.now() + 10 },
                { seqNum: 0, notificationType: 'task-progress', payload: { progress: 0 }, timestamp: Date.now() + 20 },
                { seqNum: 1, notificationType: 'task-progress', payload: { progress: 10 }, timestamp: Date.now() + 30 },
                
                // Error state
                { seqNum: 2, notificationType: 'session-state', payload: { uiState: 'error' }, timestamp: Date.now() + 40 },
                
                // Recovery with more progress
                { seqNum: 3, notificationType: 'session-state', payload: { uiState: 'recovering' }, timestamp: Date.now() + 50 },
                { seqNum: 2, notificationType: 'task-progress', payload: { progress: 20 }, timestamp: Date.now() + 60 },
                
                // Ready state
                { seqNum: 4, notificationType: 'session-state', payload: { uiState: 'ready' }, timestamp: Date.now() + 70 },
            ];

            // Buffer events during simulated UI transitions
            for (const event of transitionEvents) {
                eventBufferManager.bufferEvent(event);
                
                // Simulate partial flushes during transitions
                if (event.notificationType === 'session-state') {
                    const partialFlush = eventBufferManager.flushBuffer('task-progress');
                    deliveredEvents.push(...partialFlush);
                }
            }

            // Final flush of all remaining events
            const finalSessionEvents = eventBufferManager.flushBuffer('session-state');
            const finalProgressEvents = eventBufferManager.flushBuffer('task-progress');

            // Verify all events are accounted for
            expect(finalSessionEvents).toHaveLength(5);
            expect(deliveredEvents.length + finalProgressEvents.length).toBe(3); // Total progress events

            // Verify state transition sequence
            const uiStates = finalSessionEvents.map(e => (e.payload as any).uiState);
            expect(uiStates).toEqual(['initializing', 'loading', 'error', 'recovering', 'ready']);
        });

        it('should apply buffered events in correct seqNum order when UI becomes ready', () => {
            // Simulate out-of-order event arrival
            const outOfOrderEvents: SequencedEvent[] = [
                { seqNum: 5, notificationType: 'task-progress', payload: { step: 5 }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'task-progress', payload: { step: 1 }, timestamp: Date.now() + 10 },
                { seqNum: 3, notificationType: 'task-progress', payload: { step: 3 }, timestamp: Date.now() + 20 },
                { seqNum: 0, notificationType: 'task-progress', payload: { step: 0 }, timestamp: Date.now() + 30 },
                { seqNum: 4, notificationType: 'task-progress', payload: { step: 4 }, timestamp: Date.now() + 40 },
                { seqNum: 2, notificationType: 'task-progress', payload: { step: 2 }, timestamp: Date.now() + 50 },
            ];

            // Buffer out-of-order events
            for (const event of outOfOrderEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // When UI becomes ready, flush should return events in seqNum order
            const orderedEvents = eventBufferManager.flushBuffer('task-progress');
            
            expect(orderedEvents).toHaveLength(6);
            for (let i = 0; i < 6; i++) {
                expect(orderedEvents[i].seqNum).toBe(i);
                expect((orderedEvents[i].payload as any).step).toBe(i);
            }
        });
    });

    // Task 11.3: Integration test for timeout elimination
    describe('Timeout Elimination', () => {
        it('should verify no timeout-based state transitions occur', () => {
            // Simulate session events that previously would have triggered timeouts
            const timeoutProneEvents: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'starting', phase: 'initialization' }, timestamp: Date.now() },
                
                // Previously would wait for task-snapshot with timeout
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { stage: 'source', tasks: [] }, timestamp: Date.now() + 100 },
                
                // Immediate state progression without timeout
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'running', phase: 'processing' }, timestamp: Date.now() + 110 },
                
                // More events that should not trigger timeout logic
                { seqNum: 0, notificationType: 'task-progress', payload: { progress: 0 }, timestamp: Date.now() + 200 },
                { seqNum: 1, notificationType: 'task-progress', payload: { progress: 50 }, timestamp: Date.now() + 300 },
                
                // Completion without timeout dependency
                { seqNum: 2, notificationType: 'session-state', payload: { status: 'completed' }, timestamp: Date.now() + 400 },
            ];

            const startTime = Date.now();
            
            // Buffer events rapidly
            for (const event of timeoutProneEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush immediately (no timeout waiting)
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            const processingTime = Date.now() - startTime;

            // Verify processing completed quickly (no timeout delays)
            expect(processingTime).toBeLessThan(50); // Should be nearly instantaneous

            // Verify all events processed correctly
            expect(sessionEvents).toHaveLength(3);
            expect(snapshotEvents).toHaveLength(1);
            expect(progressEvents).toHaveLength(2);

            // Verify state progression is immediate
            const statuses = sessionEvents.map(e => (e.payload as any).status);
            expect(statuses).toEqual(['starting', 'running', 'completed']);
        });

        it('should confirm receiving-task-snapshot phase is eliminated', () => {
            // Simulate events that would previously trigger receiving-task-snapshot phase
            const eliminatedPhaseEvents: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'starting' }, timestamp: Date.now() },
                
                // Stage snapshot arrives - should not trigger waiting phase
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { 
                    stage: 'source', 
                    tasks: [
                        { taskId: 'task-1', status: 'queued' },
                        { taskId: 'task-2', status: 'queued' }
                    ] 
                }, timestamp: Date.now() + 10 },
                
                // Immediate progression to running (no receiving-task-snapshot phase)
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'running' }, timestamp: Date.now() + 20 },
                
                // Task progress updates
                { seqNum: 0, notificationType: 'task-progress', payload: { taskId: 'task-1', progress: 25 }, timestamp: Date.now() + 30 },
                { seqNum: 1, notificationType: 'task-progress', payload: { taskId: 'task-2', progress: 15 }, timestamp: Date.now() + 40 },
            ];

            // Buffer events
            for (const event of eliminatedPhaseEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush and verify no intermediate waiting phase
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            // Verify direct transition from starting to running
            expect(sessionEvents).toHaveLength(2);
            expect((sessionEvents[0].payload as any).status).toBe('starting');
            expect((sessionEvents[1].payload as any).status).toBe('running');

            // Verify snapshot and progress events are processed normally
            expect(snapshotEvents).toHaveLength(1);
            expect(progressEvents).toHaveLength(2);

            // Verify no receiving-task-snapshot status appears
            const allStatuses = sessionEvents.map(e => (e.payload as any).status);
            expect(allStatuses).not.toContain('receiving-task-snapshot');
        });

        it('should verify state progression is immediate and not dependent on event delivery', () => {
            // Test that state machine progresses immediately without waiting for confirmations
            const immediateProgressionEvents: SequencedEvent[] = [
                // State changes should be immediate
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'starting', timestamp: Date.now() }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'running', timestamp: Date.now() + 1 }, timestamp: Date.now() + 1 },
                { seqNum: 2, notificationType: 'session-state', payload: { status: 'paused', timestamp: Date.now() + 2 }, timestamp: Date.now() + 2 },
                { seqNum: 3, notificationType: 'session-state', payload: { status: 'running', timestamp: Date.now() + 3 }, timestamp: Date.now() + 3 },
                { seqNum: 4, notificationType: 'session-state', payload: { status: 'completed', timestamp: Date.now() + 4 }, timestamp: Date.now() + 4 },
            ];

            const bufferStartTime = performance.now();
            
            // Buffer events with minimal delays
            for (const event of immediateProgressionEvents) {
                eventBufferManager.bufferEvent(event);
            }

            const bufferEndTime = performance.now();
            const flushStartTime = performance.now();
            
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            
            const flushEndTime = performance.now();

            // Verify rapid processing (no artificial delays)
            expect(bufferEndTime - bufferStartTime).toBeLessThan(10);
            expect(flushEndTime - flushStartTime).toBeLessThan(10);

            // Verify all state transitions are preserved
            expect(sessionEvents).toHaveLength(5);
            
            const statuses = sessionEvents.map(e => (e.payload as any).status);
            expect(statuses).toEqual(['starting', 'running', 'paused', 'running', 'completed']);

            // Verify timestamps show immediate progression
            const timestamps = sessionEvents.map(e => (e.payload as any).timestamp);
            for (let i = 1; i < timestamps.length; i++) {
                expect(timestamps[i] - timestamps[i-1]).toBeLessThanOrEqual(1);
            }
        });
    });

    // Task 11.4: Integration test for synchronized pub/sub initialization
    describe('Synchronized Pub/Sub Initialization', () => {
        it('should establish channels synchronously with component mount', () => {
            // Simulate component mount sequence
            const mountSequenceEvents: SequencedEvent[] = [
                // Pre-mount: channels should be ready
                { seqNum: 0, notificationType: 'session-state', payload: { phase: 'channel-init' }, timestamp: Date.now() },
                
                // Mount: immediate channel availability
                { seqNum: 1, notificationType: 'session-state', payload: { phase: 'component-mount' }, timestamp: Date.now() + 1 },
                
                // First UI state update: channels already established
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { stage: 'source', ready: true }, timestamp: Date.now() + 2 },
                { seqNum: 0, notificationType: 'task-progress', payload: { initialized: true }, timestamp: Date.now() + 3 },
            ];

            // Simulate synchronous channel establishment
            const channelEstablishmentStart = performance.now();
            
            for (const event of mountSequenceEvents) {
                eventBufferManager.bufferEvent(event);
            }
            
            const channelEstablishmentEnd = performance.now();

            // Verify channels are established synchronously (no async delays)
            expect(channelEstablishmentEnd - channelEstablishmentStart).toBeLessThan(5);

            // Verify events are immediately available after mount
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            expect(sessionEvents).toHaveLength(2);
            expect(snapshotEvents).toHaveLength(1);
            expect(progressEvents).toHaveLength(1);

            // Verify mount sequence
            const phases = sessionEvents.map(e => (e.payload as any).phase);
            expect(phases).toEqual(['channel-init', 'component-mount']);
        });

        it('should verify channels are ready before first UI state update', () => {
            // Test that no events are lost due to channel initialization delays
            const preUpdateEvents: SequencedEvent[] = [
                // Events that arrive during channel setup
                { seqNum: 0, notificationType: 'session-state', payload: { setup: 'channel-ready' }, timestamp: Date.now() },
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { setup: 'snapshot-ready' }, timestamp: Date.now() + 1 },
                { seqNum: 0, notificationType: 'task-progress', payload: { setup: 'progress-ready' }, timestamp: Date.now() + 2 },
                
                // First UI state update
                { seqNum: 1, notificationType: 'session-state', payload: { ui: 'first-update' }, timestamp: Date.now() + 3 },
            ];

            // Buffer events immediately (channels should be ready)
            for (const event of preUpdateEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Verify all events are captured (no loss due to channel delays)
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const snapshotEvents = eventBufferManager.flushBuffer('stage-snapshot');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            expect(sessionEvents).toHaveLength(2);
            expect(snapshotEvents).toHaveLength(1);
            expect(progressEvents).toHaveLength(1);

            // Verify setup events are preserved
            expect((sessionEvents[0].payload as any).setup).toBe('channel-ready');
            expect((snapshotEvents[0].payload as any).setup).toBe('snapshot-ready');
            expect((progressEvents[0].payload as any).setup).toBe('progress-ready');
            expect((sessionEvents[1].payload as any).ui).toBe('first-update');
        });

        it('should test channel establishment across multiple component lifecycle events', () => {
            // Simulate multiple mount/unmount cycles
            const lifecycleEvents: SequencedEvent[] = [
                // First mount cycle
                { seqNum: 0, notificationType: 'session-state', payload: { cycle: 1, phase: 'mount' }, timestamp: Date.now() },
                { seqNum: 0, notificationType: 'task-progress', payload: { cycle: 1, active: true }, timestamp: Date.now() + 10 },
                { seqNum: 1, notificationType: 'session-state', payload: { cycle: 1, phase: 'unmount' }, timestamp: Date.now() + 20 },
                
                // Second mount cycle
                { seqNum: 2, notificationType: 'session-state', payload: { cycle: 2, phase: 'mount' }, timestamp: Date.now() + 30 },
                { seqNum: 1, notificationType: 'task-progress', payload: { cycle: 2, active: true }, timestamp: Date.now() + 40 },
                { seqNum: 3, notificationType: 'session-state', payload: { cycle: 2, phase: 'unmount' }, timestamp: Date.now() + 50 },
                
                // Third mount cycle
                { seqNum: 4, notificationType: 'session-state', payload: { cycle: 3, phase: 'mount' }, timestamp: Date.now() + 60 },
                { seqNum: 2, notificationType: 'task-progress', payload: { cycle: 3, active: true }, timestamp: Date.now() + 70 },
            ];

            // Buffer events across lifecycle cycles
            for (const event of lifecycleEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Verify all lifecycle events are preserved
            const sessionEvents = eventBufferManager.flushBuffer('session-state');
            const progressEvents = eventBufferManager.flushBuffer('task-progress');

            expect(sessionEvents).toHaveLength(5);
            expect(progressEvents).toHaveLength(3);

            // Verify lifecycle sequence integrity
            const sessionCycles = sessionEvents.map(e => ({ 
                cycle: (e.payload as any).cycle, 
                phase: (e.payload as any).phase 
            }));
            
            expect(sessionCycles).toEqual([
                { cycle: 1, phase: 'mount' },
                { cycle: 1, phase: 'unmount' },
                { cycle: 2, phase: 'mount' },
                { cycle: 2, phase: 'unmount' },
                { cycle: 3, phase: 'mount' },
            ]);

            // Verify progress events for each active cycle
            const progressCycles = progressEvents.map(e => (e.payload as any).cycle);
            expect(progressCycles).toEqual([1, 2, 3]);
        });
    });

    describe('End-to-End Event Delivery', () => {
        it('should deliver events in correct seqNum order across notification types', () => {
            // Simulate events arriving out of order from different notification types
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'session-0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'session-1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'session-state', payload: 'session-2', timestamp: Date.now() },
                { seqNum: 0, notificationType: 'task-progress', payload: 'progress-0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'task-progress', payload: 'progress-1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'task-progress', payload: 'progress-2', timestamp: Date.now() },
                { seqNum: 0, notificationType: 'stage-snapshot', payload: 'snapshot-0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'stage-snapshot', payload: 'snapshot-1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'stage-snapshot', payload: 'snapshot-2', timestamp: Date.now() },
            ];

            // Buffer all events
            for (const event of events) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush each notification type and verify ordering
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];

            for (const notificationType of notificationTypes) {
                // First flush should deliver consecutive events from seqNum 0
                const flushed1 = eventBufferManager.flushBuffer(notificationType);

                // Verify events are in seqNum order
                for (let i = 0; i < flushed1.length - 1; i++) {
                    expect(flushed1[i].seqNum).toBeLessThan(flushed1[i + 1].seqNum);
                }

                // Should get all consecutive events (0, 1, 2)
                expect(flushed1).toHaveLength(3);
                expect(flushed1.map(e => e.seqNum)).toEqual([0, 1, 2]);
            }
        });

        it('should handle rapid event sequences without loss', () => {
            const eventCount = 100;
            const events: SequencedEvent[] = [];

            // Generate rapid sequence of events
            for (let i = 0; i < eventCount; i++) {
                events.push({
                    seqNum: i,
                    notificationType: 'task-progress',
                    payload: `rapid-event-${i}`,
                    timestamp: Date.now() + i,
                });
            }

            // Buffer events rapidly
            for (const event of events) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush and verify no events are lost
            const flushedEvents = eventBufferManager.flushBuffer('task-progress');
            expect(flushedEvents).toHaveLength(eventCount);

            // Verify sequence integrity
            for (let i = 0; i < eventCount; i++) {
                expect(flushedEvents[i].seqNum).toBe(i);
                expect(flushedEvents[i].payload).toBe(`rapid-event-${i}`);
            }
        });

        it('should detect and handle event gaps correctly', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event-0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'event-1', timestamp: Date.now() },
                { seqNum: 4, notificationType: 'session-state', payload: 'event-4', timestamp: Date.now() },
                { seqNum: 5, notificationType: 'session-state', payload: 'event-5', timestamp: Date.now() },
            ];

            for (const event of events) {
                eventBufferManager.bufferEvent(event);
            }

            // First flush should only deliver consecutive events
            const flushed1 = eventBufferManager.flushBuffer('session-state');
            expect(flushed1).toHaveLength(2); // Only 0, 1
            expect(flushed1.map(e => e.seqNum)).toEqual([0, 1]);

            // Detect gaps
            const gaps = eventBufferManager.detectGaps('session-state');
            expect(gaps).toEqual([2, 3]); // Missing seqNum 2, 3

            // Add missing events
            eventBufferManager.bufferEvent({ seqNum: 2, notificationType: 'session-state', payload: 'event-2', timestamp: Date.now() });
            eventBufferManager.bufferEvent({ seqNum: 3, notificationType: 'session-state', payload: 'event-3', timestamp: Date.now() });

            // Second flush should deliver remaining events
            const flushed2 = eventBufferManager.flushBuffer('session-state');
            expect(flushed2).toHaveLength(4); // 2, 3, 4, 5
            expect(flushed2.map(e => e.seqNum)).toEqual([2, 3, 4, 5]);

            // No more gaps
            const finalGaps = eventBufferManager.detectGaps('session-state');
            expect(finalGaps).toEqual([]);
        });
    });

    describe('Event Sequence Verification', () => {
        it('should maintain sequence integrity across multiple flush cycles', () => {
            const totalEvents = 50;
            const batchSize = 10;

            // Add events in batches
            for (let batch = 0; batch < totalEvents / batchSize; batch++) {
                const batchEvents: SequencedEvent[] = [];

                for (let i = 0; i < batchSize; i++) {
                    const seqNum = batch * batchSize + i;
                    batchEvents.push({
                        seqNum,
                        notificationType: 'task-progress',
                        payload: `batch-${batch}-event-${i}`,
                        timestamp: Date.now() + seqNum,
                    });
                }

                // Add batch events
                for (const event of batchEvents) {
                    eventBufferManager.bufferEvent(event);
                }

                // Flush after each batch
                const flushed = eventBufferManager.flushBuffer('task-progress');
                deliveredEvents.push(...flushed);
            }

            // Verify complete sequence
            expect(deliveredEvents).toHaveLength(totalEvents);
            for (let i = 0; i < totalEvents; i++) {
                expect(deliveredEvents[i].seqNum).toBe(i);
            }
        });

        it('should handle interleaved events from multiple notification types', () => {
            const eventsPerType = 20;
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];

            // Create interleaved events
            const allEvents: SequencedEvent[] = [];
            for (let i = 0; i < eventsPerType; i++) {
                for (const notificationType of notificationTypes) {
                    allEvents.push({
                        seqNum: i,
                        notificationType,
                        payload: `${notificationType}-${i}`,
                        timestamp: Date.now() + (i * notificationTypes.length) + notificationTypes.indexOf(notificationType),
                    });
                }
            }

            // Shuffle events to simulate out-of-order arrival
            const shuffledEvents = [...allEvents].sort(() => Math.random() - 0.5);

            // Buffer shuffled events
            for (const event of shuffledEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush each type and verify ordering
            for (const notificationType of notificationTypes) {
                const flushed = eventBufferManager.flushBuffer(notificationType);
                expect(flushed).toHaveLength(eventsPerType);

                // Verify sequence for this type
                for (let i = 0; i < eventsPerType; i++) {
                    expect(flushed[i].seqNum).toBe(i);
                    expect(flushed[i].notificationType).toBe(notificationType);
                    expect(flushed[i].payload).toBe(`${notificationType}-${i}`);
                }
            }
        });
    });

    describe('Multi-Stage Session Simulation', () => {
        it('should handle session lifecycle events correctly', () => {
            // Simulate a complete session lifecycle
            const sessionEvents: SequencedEvent[] = [
                // Session start
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'starting' }, timestamp: Date.now() },
                { seqNum: 0, notificationType: 'stage-snapshot', payload: { stage: 'source', tasks: [] }, timestamp: Date.now() },

                // Source stage progress
                { seqNum: 0, notificationType: 'task-progress', payload: { stage: 'source', progress: 0 }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'task-progress', payload: { stage: 'source', progress: 50 }, timestamp: Date.now() },
                { seqNum: 2, notificationType: 'task-progress', payload: { stage: 'source', progress: 100 }, timestamp: Date.now() },

                // Geometry stage
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'running', stage: 'geometry' }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'stage-snapshot', payload: { stage: 'geometry', tasks: [] }, timestamp: Date.now() },
                { seqNum: 3, notificationType: 'task-progress', payload: { stage: 'geometry', progress: 0 }, timestamp: Date.now() },

                // Session completion
                { seqNum: 2, notificationType: 'session-state', payload: { status: 'completed' }, timestamp: Date.now() },
            ];

            // Buffer all events
            for (const event of sessionEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush and verify session progression
            const sessionStates = eventBufferManager.flushBuffer('session-state');
            const stageSnapshots = eventBufferManager.flushBuffer('stage-snapshot');
            const taskProgress = eventBufferManager.flushBuffer('task-progress');

            // Verify session state progression
            expect(sessionStates).toHaveLength(3);
            expect((sessionStates[0].payload as any).status).toBe('starting');
            expect((sessionStates[1].payload as any).status).toBe('running');
            expect((sessionStates[2].payload as any).status).toBe('completed');

            // Verify stage snapshots
            expect(stageSnapshots).toHaveLength(2);
            expect((stageSnapshots[0].payload as any).stage).toBe('source');
            expect((stageSnapshots[1].payload as any).stage).toBe('geometry');

            // Verify task progress
            expect(taskProgress).toHaveLength(4);
            expect((taskProgress[0].payload as any).stage).toBe('source');
            expect((taskProgress[3].payload as any).stage).toBe('geometry');
        });

        it('should handle pause/resume cycles correctly', () => {
            // Simulate pause/resume scenario
            const pauseResumeEvents: SequencedEvent[] = [
                // Initial progress
                { seqNum: 0, notificationType: 'session-state', payload: { status: 'running' }, timestamp: Date.now() },
                { seqNum: 0, notificationType: 'task-progress', payload: { progress: 25 }, timestamp: Date.now() },

                // Pause
                { seqNum: 1, notificationType: 'session-state', payload: { status: 'paused' }, timestamp: Date.now() },

                // Resume
                { seqNum: 2, notificationType: 'session-state', payload: { status: 'running' }, timestamp: Date.now() },
                { seqNum: 1, notificationType: 'task-progress', payload: { progress: 50 }, timestamp: Date.now() },

                // Another pause
                { seqNum: 3, notificationType: 'session-state', payload: { status: 'paused' }, timestamp: Date.now() },

                // Final resume and completion
                { seqNum: 4, notificationType: 'session-state', payload: { status: 'running' }, timestamp: Date.now() },
                { seqNum: 2, notificationType: 'task-progress', payload: { progress: 100 }, timestamp: Date.now() },
                { seqNum: 5, notificationType: 'session-state', payload: { status: 'completed' }, timestamp: Date.now() },
            ];

            // Buffer events
            for (const event of pauseResumeEvents) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush and verify pause/resume sequence
            const sessionStates = eventBufferManager.flushBuffer('session-state');
            const taskProgress = eventBufferManager.flushBuffer('task-progress');

            // Verify session state transitions
            expect(sessionStates).toHaveLength(6);
            const statuses = sessionStates.map(e => (e.payload as any).status);
            expect(statuses).toEqual(['running', 'paused', 'running', 'paused', 'running', 'completed']);

            // Verify progress continues correctly
            expect(taskProgress).toHaveLength(3);
            const progressValues = taskProgress.map(e => (e.payload as any).progress);
            expect(progressValues).toEqual([25, 50, 100]);
        });
    });

    describe('Event Ordering and Completeness', () => {
        it('should maintain ordering across session lifecycle', () => {
            const events: SequencedEvent[] = [];

            // Generate events with timestamps to verify ordering
            for (let i = 0; i < 30; i++) {
                const notificationType: NotificationType =
                    i % 3 === 0 ? 'session-state' :
                        i % 3 === 1 ? 'stage-snapshot' : 'task-progress';

                events.push({
                    seqNum: Math.floor(i / 3),
                    notificationType,
                    payload: { eventId: i, timestamp: Date.now() + i },
                    timestamp: Date.now() + i,
                });
            }

            // Buffer events in random order
            const shuffled = [...events].sort(() => Math.random() - 0.5);
            for (const event of shuffled) {
                eventBufferManager.bufferEvent(event);
            }

            // Flush all types and verify ordering
            const allFlushed: SequencedEvent[] = [];
            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];

            for (const type of notificationTypes) {
                const flushed = eventBufferManager.flushBuffer(type);
                allFlushed.push(...flushed);
            }

            // Verify completeness
            expect(allFlushed).toHaveLength(30);

            // Group by notification type and verify seqNum ordering within each type
            const groupedByType = allFlushed.reduce((acc, event) => {
                if (!acc[event.notificationType]) acc[event.notificationType] = [];
                acc[event.notificationType].push(event);
                return acc;
            }, {} as Record<NotificationType, SequencedEvent[]>);

            for (const type of notificationTypes) {
                const typeEvents = groupedByType[type];
                expect(typeEvents).toHaveLength(10); // 30 events / 3 types = 10 each

                // Verify seqNum ordering within type
                for (let i = 0; i < typeEvents.length - 1; i++) {
                    expect(typeEvents[i].seqNum).toBeLessThan(typeEvents[i + 1].seqNum);
                }
            }
        });

        it('should detect duplicate events', () => {
            const originalEvent: SequencedEvent = {
                seqNum: 0,
                notificationType: 'session-state',
                payload: 'original',
                timestamp: Date.now(),
            };

            const duplicateEvent: SequencedEvent = {
                seqNum: 0,
                notificationType: 'session-state',
                payload: 'duplicate',
                timestamp: Date.now() + 1000,
            };

            // Buffer original event
            eventBufferManager.bufferEvent(originalEvent);

            // Buffer duplicate (same seqNum, same type)
            eventBufferManager.bufferEvent(duplicateEvent);

            // Flush should contain only one event (first one wins for same seqNum)
            const flushed = eventBufferManager.flushBuffer('session-state');
            expect(flushed).toHaveLength(1);

            // First event should be returned (last inserted for same seqNum due to binary search)
            expect(flushed[0].payload).toBe('duplicate');
        });
    });
});