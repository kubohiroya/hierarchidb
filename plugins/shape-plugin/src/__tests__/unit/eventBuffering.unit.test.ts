/**
 * Unit tests for Worker-side unconditional event streaming
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unconditionalEventStreamer } from '../../worker/api/eventBuffering';
import type { NodeId } from '@hierarchidb/core-types';

describe('UnconditionalEventStreamer', () => {
    const testNodeId: NodeId = 'test-node-123' as NodeId;

    beforeEach(() => {
        // Clean up any existing subscriptions
        unconditionalEventStreamer.cleanup(testNodeId);
    });

    describe('subscriber exception isolation', () => {
        it('should isolate exceptions from individual subscribers', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const successfulCallback = vi.fn();
            const failingCallback = vi.fn(() => {
                throw new Error('Subscriber callback failed');
            });
            const anotherSuccessfulCallback = vi.fn();

            // Subscribe multiple callbacks
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', successfulCallback);
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', failingCallback);
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', anotherSuccessfulCallback);

            // Configure sequence numbering
            unconditionalEventStreamer.configureDistributedSeqNum(testNodeId, 0, 1);

            // Emit event
            const testEvent = {
                nodeId: testNodeId,
                sessionState: 'running',
                timestamp: Date.now()
            };

            unconditionalEventStreamer.emitEvent(testNodeId, 'session-state', testEvent);

            // All callbacks should have been called
            expect(successfulCallback).toHaveBeenCalledTimes(1);
            expect(failingCallback).toHaveBeenCalledTimes(1);
            expect(anotherSuccessfulCallback).toHaveBeenCalledTimes(1);

            // Error should have been logged with detailed information
            expect(consoleSpy).toHaveBeenCalledWith(
                '[UnconditionalEventStreamer] subscriber callback failed',
                expect.objectContaining({
                    nodeId: testNodeId,
                    eventType: 'session-state',
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'Subscriber callback failed',
                        stack: expect.any(String)
                    })
                })
            );

            consoleSpy.mockRestore();
        });

        it('should isolate exceptions in heartbeat subscribers', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const successfulCallback = vi.fn();
            const failingCallback = vi.fn(() => {
                throw new Error('Heartbeat callback failed');
            });

            // Subscribe heartbeat callbacks
            unconditionalEventStreamer.subscribe(testNodeId, 'heartbeat', successfulCallback);
            unconditionalEventStreamer.subscribe(testNodeId, 'heartbeat', failingCallback);

            // Emit heartbeat event
            const heartbeatEvent = {
                nodeId: testNodeId,
                heartbeatAt: Date.now()
            };

            unconditionalEventStreamer.emitHeartbeat(testNodeId, heartbeatEvent);

            // Both callbacks should have been called
            expect(successfulCallback).toHaveBeenCalledTimes(1);
            expect(failingCallback).toHaveBeenCalledTimes(1);

            // Error should have been logged with heartbeat-specific information
            expect(consoleSpy).toHaveBeenCalledWith(
                '[UnconditionalEventStreamer] subscriber callback failed',
                expect.objectContaining({
                    nodeId: testNodeId,
                    eventType: 'heartbeat',
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'Heartbeat callback failed'
                    })
                })
            );

            consoleSpy.mockRestore();
        });

        it('should handle non-Error exceptions', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const failingCallback = vi.fn(() => {
                throw 'String error';
            });

            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', failingCallback);
            unconditionalEventStreamer.configureDistributedSeqNum(testNodeId, 0, 1);

            const testEvent = {
                nodeId: testNodeId,
                sessionState: 'running',
                timestamp: Date.now()
            };

            unconditionalEventStreamer.emitEvent(testNodeId, 'session-state', testEvent);

            // Should handle non-Error exceptions gracefully
            expect(consoleSpy).toHaveBeenCalledWith(
                '[UnconditionalEventStreamer] subscriber callback failed',
                expect.objectContaining({
                    nodeId: testNodeId,
                    eventType: 'session-state',
                    error: 'String error'
                })
            );

            consoleSpy.mockRestore();
        });

        it('should continue processing after subscriber exceptions', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const callback1 = vi.fn();
            const failingCallback = vi.fn(() => {
                throw new Error('First failure');
            });
            const callback2 = vi.fn();

            // Subscribe in order
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', callback1);
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', failingCallback);
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', callback2);

            unconditionalEventStreamer.configureDistributedSeqNum(testNodeId, 0, 1);

            // Emit multiple events
            for (let i = 0; i < 3; i++) {
                const testEvent = {
                    nodeId: testNodeId,
                    sessionState: `state-${i}`,
                    timestamp: Date.now()
                };
                unconditionalEventStreamer.emitEvent(testNodeId, 'session-state', testEvent);
            }

            // All callbacks should continue to be called despite failures
            expect(callback1).toHaveBeenCalledTimes(3);
            expect(failingCallback).toHaveBeenCalledTimes(3);
            expect(callback2).toHaveBeenCalledTimes(3);

            // Should have logged 3 errors
            expect(consoleSpy).toHaveBeenCalledTimes(3);

            consoleSpy.mockRestore();
        });
    });

    describe('event delivery without exceptions', () => {
        it('should deliver events to all subscribers when no exceptions occur', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', callback1);
            unconditionalEventStreamer.subscribe(testNodeId, 'session-state', callback2);
            unconditionalEventStreamer.subscribe(testNodeId, 'task-progress', callback3);

            unconditionalEventStreamer.configureDistributedSeqNum(testNodeId, 0, 1);

            const sessionEvent = {
                nodeId: testNodeId,
                sessionState: 'running',
                timestamp: Date.now()
            };

            const progressEvent = {
                nodeId: testNodeId,
                taskId: 'task-1',
                progress: { completed: 5, total: 10 },
                timestamp: Date.now()
            };

            unconditionalEventStreamer.emitEvent(testNodeId, 'session-state', sessionEvent);
            unconditionalEventStreamer.emitEvent(testNodeId, 'task-progress', progressEvent);

            // Session-state subscribers should receive session event
            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback1).toHaveBeenCalledWith(expect.objectContaining({
                notificationType: 'session-state',
                payload: sessionEvent,
                seqNum: expect.any(Number)
            }));

            // Task-progress subscriber should receive progress event
            expect(callback3).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledWith(expect.objectContaining({
                notificationType: 'task-progress',
                payload: progressEvent,
                seqNum: expect.any(Number)
            }));
        });
    });
});