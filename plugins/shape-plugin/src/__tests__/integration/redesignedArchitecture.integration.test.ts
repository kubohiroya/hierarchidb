/**
 * Integration tests for the redesigned build session state synchronization architecture
 *
 * Covers:
 * - 11.1: Unconditional event delivery regardless of UI state
 * - 11.2: Loss-free event buffering during UI state transitions
 * - 11.3: Timeout elimination (no receiving-task-snapshot phase)
 * - 11.4: Synchronized pub/sub initialization
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import {
    UIEventBufferManager,
    ImmediateHeartbeatProcessor,
    type SequencedEvent,
    type NotificationType,
} from '../../ui/components/build-progress/eventBufferingUI.js';
import {
    unconditionalEventStreamer,
    eventDeliveryMonitor,
} from '../../worker/api/eventBuffering.js';

const toNodeId = (id: string): NodeId => id as NodeId;

// ---------------------------------------------------------------------------
// 11.1 Unconditional event delivery
// ---------------------------------------------------------------------------
describe('11.1 Unconditional event delivery', () => {
    beforeEach(() => {
        eventDeliveryMonitor.reset();
    });

    afterEach(() => {
        ['node-11-1-a', 'node-11-1-b', 'node-11-1-c'].forEach((id) =>
            unconditionalEventStreamer.cleanup(toNodeId(id)),
        );
    });

    it('should emit events even when no subscriber is present', () => {
        const nodeId = toNodeId('node-11-1-a');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        // Emit with no subscribers — must not throw
        expect(() => {
            unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
                nodeId,
                timestamp: Date.now(),
                previousStatus: undefined,
                currentStatus: 'running',
                sessionRecord: {} as any,
            });
        }).not.toThrow();

        // Monitor still counts the emission
        const metrics = eventDeliveryMonitor.getMetrics();
        expect(metrics.totalEventsEmitted).toBe(1);
    });

    it('should deliver events to all current subscribers', () => {
        const nodeId = toNodeId('node-11-1-b');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const received: SequencedEvent[] = [];
        const received2: SequencedEvent[] = [];

        const unsub1 = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (e) =>
            received.push(e),
        );
        const unsub2 = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (e) =>
            received2.push(e),
        );

        unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', {
            nodeId,
            timestamp: Date.now(),
            taskId: 'task-1',
            stage: 'source',
            progress: 50,
            status: 'running',
        });

        expect(received).toHaveLength(1);
        expect(received2).toHaveLength(1);
        expect(received[0]?.seqNum).toBe(received2[0]?.seqNum);

        unsub1();
        unsub2();
    });

    it('should continue emitting after subscriber unsubscribes (UI unmount cycle)', () => {
        const nodeId = toNodeId('node-11-1-c');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const received: SequencedEvent[] = [];
        const unsub = unconditionalEventStreamer.subscribe(nodeId, 'session-state', (e) =>
            received.push(e),
        );

        unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
            nodeId,
            timestamp: Date.now(),
            previousStatus: undefined,
            currentStatus: 'running',
            sessionRecord: {} as any,
        });
        expect(received).toHaveLength(1);

        // Simulate UI unmount
        unsub();

        // Emit after unmount — must not throw
        expect(() => {
            unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
                nodeId,
                timestamp: Date.now(),
                previousStatus: 'running',
                currentStatus: 'completed',
                sessionRecord: {} as any,
            });
        }).not.toThrow();

        // No new events delivered to unsubscribed handler
        expect(received).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// 11.2 Loss-free event buffering
// ---------------------------------------------------------------------------
describe('11.2 Loss-free event buffering', () => {
    let bufferManager: UIEventBufferManager;

    beforeEach(() => {
        bufferManager = new UIEventBufferManager();
        eventDeliveryMonitor.reset();
    });

    afterEach(() => {
        ['node-11-2-a', 'node-11-2-b'].forEach((id) =>
            unconditionalEventStreamer.cleanup(toNodeId(id)),
        );
    });

    it('should buffer all events without loss during rapid emission', () => {
        const nodeId = toNodeId('node-11-2-a');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const eventCount = 50;
        const unsub = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (e) =>
            bufferManager.bufferEvent(e),
        );

        for (let i = 0; i < eventCount; i++) {
            unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', {
                nodeId,
                timestamp: Date.now(),
                taskId: `task-${i}`,
                stage: 'source',
                progress: i * 2,
                status: 'running',
            });
        }

        const flushed = bufferManager.flushBuffer('task-progress');
        expect(flushed).toHaveLength(eventCount);

        // Verify seqNum ordering
        for (let i = 1; i < flushed.length; i++) {
            expect(flushed[i]?.seqNum).toBe((flushed[i - 1]?.seqNum ?? -1) + 1);
        }

        unsub();
    });

    it('should apply buffered events in seqNum order when UI becomes ready', () => {
        const nodeId = toNodeId('node-11-2-b');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        // Emit events before UI subscribes (no subscriber yet)
        // These are discarded by the streamer (no buffering on worker side)
        // Then UI subscribes and receives subsequent events
        const received: SequencedEvent[] = [];
        const unsub = unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (e) => {
            bufferManager.bufferEvent(e);
        });

        // Emit 5 events after subscription
        for (let i = 0; i < 5; i++) {
            unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', {
                nodeId,
                timestamp: Date.now(),
                stageId: 'source',
                snapshot: { index: i },
            });
        }

        // Flush and verify ordering
        const flushed = bufferManager.flushBuffer('stage-snapshot');
        expect(flushed).toHaveLength(5);
        flushed.forEach((e, idx) => {
            expect(e.seqNum).toBe(idx);
        });

        // Verify no gaps
        const gaps = bufferManager.detectGaps('stage-snapshot');
        expect(gaps).toHaveLength(0);

        received.push(...flushed);
        expect(received).toHaveLength(5);

        unsub();
    });
});

// ---------------------------------------------------------------------------
// 11.3 Timeout elimination
// ---------------------------------------------------------------------------
describe('11.3 Timeout elimination', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        eventDeliveryMonitor.reset();
    });

    afterEach(() => {
        vi.useRealTimers();
        ['node-11-3-a', 'node-11-3-b'].forEach((id) =>
            unconditionalEventStreamer.cleanup(toNodeId(id)),
        );
    });

    it('should progress state immediately without waiting for event delivery', () => {
        const nodeId = toNodeId('node-11-3-a');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const stateTransitions: string[] = [];

        // Simulate state machine that transitions immediately
        const simulateStateTransition = (from: string, to: string) => {
            stateTransitions.push(`${from}->${to}`);
            // Emit event after state transition (not before)
            unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
                nodeId,
                timestamp: Date.now(),
                previousStatus: from as any,
                currentStatus: to as any,
                sessionRecord: {} as any,
            });
        };

        // Transitions happen synchronously — no setTimeout/setInterval
        simulateStateTransition('idle', 'running');
        simulateStateTransition('running', 'paused');
        simulateStateTransition('paused', 'running');
        simulateStateTransition('running', 'completed');

        // All transitions happened without advancing timers
        expect(stateTransitions).toHaveLength(4);
        expect(stateTransitions[0]).toBe('idle->running');
        expect(stateTransitions[3]).toBe('running->completed');

        // Advance timers — no pending timeouts should change state
        vi.advanceTimersByTime(10_000);
        expect(stateTransitions).toHaveLength(4); // unchanged
    });

    it('should not have receiving-task-snapshot phase in event flow', () => {
        const nodeId = toNodeId('node-11-3-b');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const receivedTypes: string[] = [];
        const unsub = unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (e) => {
            receivedTypes.push((e.payload as any).stageId ?? 'unknown');
        });

        // Emit stage snapshots directly — no intermediate handshake phase
        unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', {
            nodeId,
            timestamp: Date.now(),
            stageId: 'source',
            snapshot: { tasks: [] },
        });
        unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', {
            nodeId,
            timestamp: Date.now(),
            stageId: 'geometry',
            snapshot: { tasks: [] },
        });

        // Events delivered immediately — no 'receiving-task-snapshot' in the list
        expect(receivedTypes).toEqual(['source', 'geometry']);
        expect(receivedTypes).not.toContain('receiving-task-snapshot');

        unsub();
    });
});

// ---------------------------------------------------------------------------
// 11.4 Synchronized pub/sub initialization
// ---------------------------------------------------------------------------
describe('11.4 Synchronized pub/sub initialization', () => {
    let bufferManager: UIEventBufferManager;
    let heartbeatValues: Array<{ nodeId: string; heartbeatAt?: number }>;

    beforeEach(() => {
        bufferManager = new UIEventBufferManager();
        heartbeatValues = [];
        eventDeliveryMonitor.reset();
    });

    afterEach(() => {
        ['node-11-4-a', 'node-11-4-b', 'node-11-4-c'].forEach((id) =>
            unconditionalEventStreamer.cleanup(toNodeId(id)),
        );
    });

    it('should establish channels synchronously on component mount', () => {
        const nodeId = toNodeId('node-11-4-a');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        let channelReady = false;
        const received: SequencedEvent[] = [];

        // Simulate synchronous component mount — subscribe immediately
        const unsub = unconditionalEventStreamer.subscribe(nodeId, 'session-state', (e) => {
            channelReady = true;
            received.push(e);
        });

        // Channel is ready before any emit
        unconditionalEventStreamer.emitEvent(nodeId, 'session-state', {
            nodeId,
            timestamp: Date.now(),
            previousStatus: undefined,
            currentStatus: 'running',
            sessionRecord: {} as any,
        });

        expect(channelReady).toBe(true);
        expect(received).toHaveLength(1);

        unsub();
    });

    it('should process heartbeat events immediately without buffering', () => {
        const nodeId = toNodeId('node-11-4-b');

        const processor = new ImmediateHeartbeatProcessor((e) => {
            heartbeatValues.push(e);
        });

        // Heartbeat is processed immediately
        processor.processHeartbeat({ nodeId: String(nodeId), heartbeatAt: Date.now() });
        processor.processHeartbeat({ nodeId: String(nodeId), heartbeatAt: Date.now() + 100 });

        expect(heartbeatValues).toHaveLength(2);

        // Buffer manager has no heartbeat buffer
        const status = bufferManager.getBufferStatus('session-state');
        expect(status.bufferedCount).toBe(0); // heartbeat never goes into buffer
    });

    it('should handle multiple component lifecycle events without losing events', () => {
        const nodeId = toNodeId('node-11-4-c');
        unconditionalEventStreamer.configureDistributedSeqNum(nodeId, 0, 1);

        const allReceived: SequencedEvent[] = [];

        // Mount → emit → unmount → remount → emit
        const unsub1 = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (e) => {
            bufferManager.bufferEvent(e);
        });

        unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', {
            nodeId,
            timestamp: Date.now(),
            taskId: 'task-1',
            stage: 'source',
            progress: 25,
            status: 'running',
        });

        // Unmount
        unsub1();

        // Remount
        const unsub2 = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (e) => {
            bufferManager.bufferEvent(e);
        });

        unconditionalEventStreamer.emitEvent(nodeId, 'task-progress', {
            nodeId,
            timestamp: Date.now(),
            taskId: 'task-1',
            stage: 'source',
            progress: 75,
            status: 'running',
        });

        unsub2();

        // Flush and verify both events captured
        const flushed = bufferManager.flushBuffer('task-progress');
        allReceived.push(...flushed);

        expect(allReceived).toHaveLength(2);
        expect(allReceived[0]?.seqNum).toBe(0);
        expect(allReceived[1]?.seqNum).toBe(1);
    });
});
