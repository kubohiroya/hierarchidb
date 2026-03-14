/**
 * UI-side event buffering with seqNum-based ordering
 * Implements per-notification-type buffering with sequence number ordering
 */

export type NotificationType = 'session-state' | 'stage-snapshot' | 'task-progress';

export interface SequencedEvent {
    seqNum: number;
    notificationType: NotificationType;
    payload: unknown;
    timestamp: number;
}

export interface EventBuffer {
    events: SequencedEvent[];
    lastAppliedSeqNum: number | null;
    gapDetected: boolean;
}

export interface EventBufferManager {
    bufferEvent(event: SequencedEvent): void;
    flushBuffer(notificationType: NotificationType): SequencedEvent[];
    detectGaps(notificationType: NotificationType): number[];
    getBufferStatus(notificationType: NotificationType): {
        bufferedCount: number;
        lastAppliedSeqNum: number | null;
        hasGaps: boolean;
    };
    reset(): void;
}

/**
 * Manages per-notification-type event buffers with seqNum ordering
 */
export class UIEventBufferManager implements EventBufferManager {
    private static readonly MAX_BUFFER_SIZE = 1000;
    private static readonly BUFFER_CLEANUP_THRESHOLD = 800;

    private buffers: Record<NotificationType, EventBuffer> = {
        'session-state': { events: [], lastAppliedSeqNum: null, gapDetected: false },
        'stage-snapshot': { events: [], lastAppliedSeqNum: null, gapDetected: false },
        'task-progress': { events: [], lastAppliedSeqNum: null, gapDetected: false },
    };

    bufferEvent(event: SequencedEvent): void {
        if (!Number.isFinite(event.seqNum) || event.seqNum < 0) {
            throw new Error(`Invalid seqNum: ${event.seqNum}`);
        }

        const buffer = this.buffers[event.notificationType];
        if (!buffer) {
            throw new Error(`Unknown notification type: ${event.notificationType}`);
        }

        // Insert event in seqNum order
        const insertIndex = this.findInsertIndex(buffer.events, event.seqNum);
        buffer.events.splice(insertIndex, 0, event);

        // Buffer size limit check (after insertion)
        if (buffer.events.length > UIEventBufferManager.MAX_BUFFER_SIZE) {
            // Remove old events (FIFO)
            const removeCount = buffer.events.length - UIEventBufferManager.BUFFER_CLEANUP_THRESHOLD;
            buffer.events.splice(0, removeCount);
            console.warn(`[UIEventBufferManager] Buffer overflow for ${event.notificationType}, removed ${removeCount} old events`);
        }

        // Detect gaps
        this.updateGapDetection(event.notificationType);
    }

    flushBuffer(notificationType: NotificationType): SequencedEvent[] {
        const buffer = this.buffers[notificationType];
        if (!buffer) {
            throw new Error(`Unknown notification type: ${notificationType}`);
        }

        const readyEvents: SequencedEvent[] = [];
        const expectedSeqNum = (buffer.lastAppliedSeqNum ?? -1) + 1;

        // Find consecutive events starting from expected seqNum
        let currentSeqNum = expectedSeqNum;
        while (buffer.events.length > 0 && buffer.events[0]?.seqNum === currentSeqNum) {
            const event = buffer.events.shift();
            if (!event) break;
            readyEvents.push(event);
            buffer.lastAppliedSeqNum = currentSeqNum;
            currentSeqNum++;
        }

        // Update gap detection after flush
        this.updateGapDetection(notificationType);

        return readyEvents;
    }

    detectGaps(notificationType: NotificationType): number[] {
        const buffer = this.buffers[notificationType];
        if (!buffer || buffer.events.length === 0) {
            return [];
        }

        const gaps: number[] = [];
        const expectedSeqNum = (buffer.lastAppliedSeqNum ?? -1) + 1;

        // Check for gap at the beginning
        const firstEvent = buffer.events[0];
        if (buffer.events.length > 0 && firstEvent && firstEvent.seqNum > expectedSeqNum) {
            for (let seq = expectedSeqNum; seq < firstEvent.seqNum; seq++) {
                gaps.push(seq);
            }
        }

        // Check for gaps between buffered events
        for (let i = 0; i < buffer.events.length - 1; i++) {
            const currentEvent = buffer.events[i];
            const nextEvent = buffer.events[i + 1];
            if (!currentEvent || !nextEvent) continue;

            const currentSeq = currentEvent.seqNum;
            const nextSeq = nextEvent.seqNum;

            for (let seq = currentSeq + 1; seq < nextSeq; seq++) {
                gaps.push(seq);
            }
        }

        return gaps;
    }

    getBufferStatus(notificationType: NotificationType): {
        bufferedCount: number;
        lastAppliedSeqNum: number | null;
        hasGaps: boolean;
    } {
        const buffer = this.buffers[notificationType];
        if (!buffer) {
            throw new Error(`Unknown notification type: ${notificationType}`);
        }

        return {
            bufferedCount: buffer.events.length,
            lastAppliedSeqNum: buffer.lastAppliedSeqNum,
            hasGaps: buffer.gapDetected,
        };
    }

    reset(): void {
        for (const notificationType of Object.keys(this.buffers) as NotificationType[]) {
            this.buffers[notificationType] = {
                events: [],
                lastAppliedSeqNum: null,
                gapDetected: false,
            };
        }
    }

    private findInsertIndex(events: SequencedEvent[], seqNum: number): number {
        let left = 0;
        let right = events.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const midEvent = events[mid];
            if (!midEvent) break;

            if (midEvent.seqNum < seqNum) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        return left;
    }

    private updateGapDetection(notificationType: NotificationType): void {
        const buffer = this.buffers[notificationType];
        const gaps = this.detectGaps(notificationType);
        buffer.gapDetected = gaps.length > 0;
    }
}

/**
 * Log event reception and processing on UI side for monitoring and debugging.
 * Tracks delivery latency from Worker emission to UI processing.
 */
export const logUIEventReception = (
    events: SequencedEvent[],
    processingStatus: 'success' | 'error',
    error?: unknown,
): void => {
    if (events.length === 0) return;
    const now = Date.now();
    const latencies = events.map((e) => now - e.timestamp);
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    if (processingStatus === 'error') {
        console.error('[UIEventReception] Events processed with error', {
            eventCount: events.length,
            processingStatus,
            avgLatencyMs: avgLatency,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
        });
    } else {
        console.log('[UIEventReception] Events processed on UI side', {
            eventCount: events.length,
            processingStatus,
            avgLatencyMs: avgLatency,
            seqNums: events.map((e) => e.seqNum),
        });
    }
};

/**
 * Heartbeat events are processed immediately without buffering
 */
export interface HeartbeatProcessor {
    processHeartbeat(event: { nodeId: string; heartbeatAt?: number }): void;
}

export class ImmediateHeartbeatProcessor implements HeartbeatProcessor {
    constructor(private callback: (event: { nodeId: string; heartbeatAt?: number }) => void) { }

    processHeartbeat(event: { nodeId: string; heartbeatAt?: number }): void {
        // Process immediately without buffering (latest value only)
        this.callback(event);
    }
}