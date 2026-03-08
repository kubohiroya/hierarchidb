/**
 * Unit tests for UI-side event buffering with seqNum ordering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    UIEventBufferManager,
    ImmediateHeartbeatProcessor,
    type SequencedEvent,
    type NotificationType
} from '../../eventBufferingUI';

describe('UIEventBufferManager', () => {
    let bufferManager: UIEventBufferManager;

    beforeEach(() => {
        bufferManager = new UIEventBufferManager();
    });

    describe('bufferEvent', () => {
        it('should buffer events in seqNum order', () => {
            const events: SequencedEvent[] = [
                { seqNum: 3, notificationType: 'session-state', payload: 'event3', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'event1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            const status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBe(3);
        });

        it('should reject invalid seqNum', () => {
            const invalidEvents = [
                { seqNum: -1, notificationType: 'session-state' as NotificationType, payload: 'invalid', timestamp: Date.now() },
                { seqNum: NaN, notificationType: 'session-state' as NotificationType, payload: 'invalid', timestamp: Date.now() },
                { seqNum: Infinity, notificationType: 'session-state' as NotificationType, payload: 'invalid', timestamp: Date.now() },
            ];

            for (const event of invalidEvents) {
                expect(() => bufferManager.bufferEvent(event)).toThrow('Invalid seqNum');
            }
        });

        it('should reject unknown notification types', () => {
            const invalidEvent = {
                seqNum: 1,
                notificationType: 'unknown-type' as NotificationType,
                payload: 'invalid',
                timestamp: Date.now(),
            };

            expect(() => bufferManager.bufferEvent(invalidEvent)).toThrow('Unknown notification type');
        });
    });

    describe('flushBuffer', () => {
        it('should flush consecutive events starting from expected seqNum', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'event1', timestamp: Date.now() },
                { seqNum: 4, notificationType: 'session-state', payload: 'event4', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            // First flush should return events 0, 1, 2 (consecutive from start, gap at 3)
            const flushed1 = bufferManager.flushBuffer('session-state');
            expect(flushed1).toHaveLength(3);
            expect(flushed1.map(e => e.seqNum)).toEqual([0, 1, 2]);
            expect(flushed1.map(e => e.payload)).toEqual(['event0', 'event1', 'event2']);

            // Buffer should still contain event 4 (gap at seqNum 3)
            const status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBe(1);
            expect(status.lastAppliedSeqNum).toBe(2);

            // Add event 5 to extend the gap
            bufferManager.bufferEvent({ seqNum: 5, notificationType: 'session-state', payload: 'event5', timestamp: Date.now() });

            // Second flush should return nothing (gap at seqNum 3)
            const flushed2 = bufferManager.flushBuffer('session-state');
            expect(flushed2).toHaveLength(0);

            // Add missing event 3
            bufferManager.bufferEvent({ seqNum: 3, notificationType: 'session-state', payload: 'event3', timestamp: Date.now() });

            // Third flush should return events 3, 4, 5 (consecutive after gap filled)
            const flushed3 = bufferManager.flushBuffer('session-state');
            expect(flushed3).toHaveLength(3);
            expect(flushed3.map(e => e.seqNum)).toEqual([3, 4, 5]);
            expect(flushed3.map(e => e.payload)).toEqual(['event3', 'event4', 'event5']);

            // Buffer should now be empty
            const finalStatus = bufferManager.getBufferStatus('session-state');
            expect(finalStatus.bufferedCount).toBe(0);
            expect(finalStatus.lastAppliedSeqNum).toBe(5);
        });

        it('should handle empty buffer', () => {
            const flushed = bufferManager.flushBuffer('session-state');
            expect(flushed).toHaveLength(0);
        });

        it('should handle buffer with gap at beginning', () => {
            bufferManager.bufferEvent({ seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() });

            const flushed = bufferManager.flushBuffer('session-state');
            expect(flushed).toHaveLength(0); // Gap at seqNum 0, 1

            const status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBe(1);
            expect(status.lastAppliedSeqNum).toBe(null);
        });
    });

    describe('detectGaps', () => {
        it('should detect gaps at beginning', () => {
            bufferManager.bufferEvent({ seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() });

            const gaps = bufferManager.detectGaps('session-state');
            expect(gaps).toEqual([0, 1]);
        });

        it('should detect gaps between events', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event0', timestamp: Date.now() },
                { seqNum: 3, notificationType: 'session-state', payload: 'event3', timestamp: Date.now() },
                { seqNum: 6, notificationType: 'session-state', payload: 'event6', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            // Flush first event
            bufferManager.flushBuffer('session-state');

            const gaps = bufferManager.detectGaps('session-state');
            expect(gaps).toEqual([1, 2, 4, 5]); // Missing 1,2 between 0,3 and 4,5 between 3,6
        });

        it('should return empty array for consecutive events', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'event1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            const gaps = bufferManager.detectGaps('session-state');
            expect(gaps).toEqual([]);
        });

        it('should return empty array for empty buffer', () => {
            const gaps = bufferManager.detectGaps('session-state');
            expect(gaps).toEqual([]);
        });
    });

    describe('getBufferStatus', () => {
        it('should return correct status for empty buffer', () => {
            const status = bufferManager.getBufferStatus('session-state');
            expect(status).toEqual({
                bufferedCount: 0,
                lastAppliedSeqNum: null,
                hasGaps: false,
            });
        });

        it('should return correct status after buffering and flushing', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event0', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'session-state', payload: 'event2', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            // Before flush
            let status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBe(2);
            expect(status.hasGaps).toBe(true); // Gap at seqNum 1

            // After flush
            bufferManager.flushBuffer('session-state');
            status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBe(1); // Only event 2 remains
            expect(status.lastAppliedSeqNum).toBe(0); // Only event 0 was flushed
            expect(status.hasGaps).toBe(true); // Still gap at seqNum 1
        });
    });

    describe('reset', () => {
        it('should reset all buffers', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'event0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'stage-snapshot', payload: 'event1', timestamp: Date.now() },
                { seqNum: 2, notificationType: 'task-progress', payload: 'event2', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            bufferManager.reset();

            const notificationTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
            for (const type of notificationTypes) {
                const status = bufferManager.getBufferStatus(type);
                expect(status).toEqual({
                    bufferedCount: 0,
                    lastAppliedSeqNum: null,
                    hasGaps: false,
                });
            }
        });
    });

    describe('per-notification-type isolation', () => {
        it('should maintain separate buffers for each notification type', () => {
            const events: SequencedEvent[] = [
                { seqNum: 0, notificationType: 'session-state', payload: 'session0', timestamp: Date.now() },
                { seqNum: 0, notificationType: 'stage-snapshot', payload: 'snapshot0', timestamp: Date.now() },
                { seqNum: 0, notificationType: 'task-progress', payload: 'progress0', timestamp: Date.now() },
                { seqNum: 1, notificationType: 'session-state', payload: 'session1', timestamp: Date.now() },
            ];

            for (const event of events) {
                bufferManager.bufferEvent(event);
            }

            // Each type should have independent seqNum sequences
            const sessionFlushed = bufferManager.flushBuffer('session-state');
            expect(sessionFlushed).toHaveLength(2);
            expect(sessionFlushed.map(e => e.payload)).toEqual(['session0', 'session1']);

            const snapshotFlushed = bufferManager.flushBuffer('stage-snapshot');
            expect(snapshotFlushed).toHaveLength(1);
            expect(snapshotFlushed[0].payload).toBe('snapshot0');

            const progressFlushed = bufferManager.flushBuffer('task-progress');
            expect(progressFlushed).toHaveLength(1);
            expect(progressFlushed[0].payload).toBe('progress0');
        });
    });
});

describe('ImmediateHeartbeatProcessor', () => {
    it('should process heartbeat events immediately', () => {
        const processedEvents: Array<{ nodeId: string; heartbeatAt?: number }> = [];
        const processor = new ImmediateHeartbeatProcessor((event) => {
            processedEvents.push(event);
        });

        const heartbeatEvents = [
            { nodeId: 'node1', heartbeatAt: 1000 },
            { nodeId: 'node1', heartbeatAt: 2000 },
            { nodeId: 'node1', heartbeatAt: 3000 },
        ];

        for (const event of heartbeatEvents) {
            processor.processHeartbeat(event);
        }

        expect(processedEvents).toEqual(heartbeatEvents);
    });

    it('should handle heartbeat events without heartbeatAt', () => {
        const processedEvents: Array<{ nodeId: string; heartbeatAt?: number }> = [];
        const processor = new ImmediateHeartbeatProcessor((event) => {
            processedEvents.push(event);
        });

        const event = { nodeId: 'node1' };
        processor.processHeartbeat(event);

        expect(processedEvents).toEqual([event]);
    });
});
    describe('buffer size limits', () => {
        let bufferManager: UIEventBufferManager;

        beforeEach(() => {
            bufferManager = new UIEventBufferManager();
        });

        it('should enforce buffer size limits and cleanup old events', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            // Fill buffer beyond MAX_BUFFER_SIZE (1000)
            for (let i = 0; i < 1100; i++) {
                bufferManager.bufferEvent({
                    seqNum: i,
                    notificationType: 'session-state',
                    payload: `event${i}`,
                    timestamp: Date.now()
                });
            }

            // Buffer should be cleaned up when it exceeds MAX_BUFFER_SIZE
            // The cleanup happens after insertion, so final size may vary slightly
            const status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBeLessThanOrEqual(1000);
            expect(status.bufferedCount).toBeGreaterThan(800);
            
            // Should have logged warning about buffer overflow
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[UIEventBufferManager] Buffer overflow for session-state, removed')
            );
            
            consoleSpy.mockRestore();
        });

        it('should maintain seqNum ordering after buffer cleanup', () => {
            // Fill buffer with events in reverse order
            for (let i = 1100; i >= 0; i--) {
                bufferManager.bufferEvent({
                    seqNum: i,
                    notificationType: 'session-state',
                    payload: `event${i}`,
                    timestamp: Date.now()
                });
            }

            // Buffer should be cleaned up but maintain ordering
            const status = bufferManager.getBufferStatus('session-state');
            expect(status.bufferedCount).toBeLessThanOrEqual(1000);
            expect(status.bufferedCount).toBeGreaterThan(800);
            
            // Flush should still work correctly with remaining events
            const flushed = bufferManager.flushBuffer('session-state');
            expect(flushed.length).toBeGreaterThan(0);
            
            // Verify ordering is maintained
            for (let i = 1; i < flushed.length; i++) {
                expect(flushed[i].seqNum).toBeGreaterThan(flushed[i - 1].seqNum);
            }
        });

        it('should handle buffer cleanup for different notification types independently', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            // Fill session-state buffer beyond limit
            for (let i = 0; i < 1100; i++) {
                bufferManager.bufferEvent({
                    seqNum: i,
                    notificationType: 'session-state',
                    payload: `session${i}`,
                    timestamp: Date.now()
                });
            }

            // Add some events to other buffers (should not be affected)
            for (let i = 0; i < 10; i++) {
                bufferManager.bufferEvent({
                    seqNum: i,
                    notificationType: 'stage-snapshot',
                    payload: `snapshot${i}`,
                    timestamp: Date.now()
                });
            }

            const sessionStatus = bufferManager.getBufferStatus('session-state');
            const snapshotStatus = bufferManager.getBufferStatus('stage-snapshot');
            
            expect(sessionStatus.bufferedCount).toBeLessThanOrEqual(1000); // Cleaned up
            expect(sessionStatus.bufferedCount).toBeGreaterThan(800);
            expect(snapshotStatus.bufferedCount).toBe(10); // Unaffected
            
            consoleSpy.mockRestore();
        });
    });