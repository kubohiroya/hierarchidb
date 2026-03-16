/**
 * UI-side event buffering for Worker→UI event delivery.
 *
 * Design (per build-session-worker-ui-event-spec.md):
 * - session-state and stage-snapshot use simple FIFO queues. Events are applied
 *   unconditionally in arrival order.
 * - task-progress uses per-taskId version deduplication:
 *   - version > lastAppliedVersion[taskId] → accept
 *   - version === lastAppliedVersion[taskId] → drop (duplicate)
 *   - version < lastAppliedVersion[taskId] → drop (stale / out-of-order)
 * - heartbeat: immediate pass-through, no buffering.
 *
 * Rationale: Worker emits progress at high frequency. Without deduplication,
 * the UI would apply every intermediate value even when a newer one has already
 * arrived for the same task. Per-taskId versioning ensures only the latest
 * progress per task is applied within each animation frame.
 */

export type NotificationType = 'session-state' | 'stage-snapshot' | 'task-progress';

/** A buffered event in the FIFO queue (session-state / stage-snapshot only). */
export interface BufferedEvent {
    notificationType: NotificationType;
    payload: unknown;
    timestamp: number;
}

export interface FifoEventQueue {
    events: BufferedEvent[];
}

export interface EventBufferManager {
    enqueue(event: BufferedEvent): void;
    /** Flush all queued events for the given FIFO notification type. */
    flushFifo(notificationType: 'session-state' | 'stage-snapshot'): BufferedEvent[];
    /**
     * Apply a task-progress event with per-taskId version deduplication.
     * Returns the event if accepted, undefined if dropped.
     */
    applyTaskProgress(taskId: string, version: number, payload: unknown): BufferedEvent | undefined;
    reset(): void;
}

/**
 * Manages UI-side event queues.
 *
 * session-state and stage-snapshot use FIFO queues.
 * task-progress uses per-taskId version tracking to drop stale events.
 */
export class UIEventBufferManager implements EventBufferManager {
    private fifoQueues: Record<'session-state' | 'stage-snapshot', FifoEventQueue> = {
        'session-state': { events: [] },
        'stage-snapshot': { events: [] },
    };

    /** Last accepted version per taskId. */
    private lastVersionByTaskId: Map<string, number> = new Map();

    enqueue(event: BufferedEvent): void {
        if (event.notificationType === 'task-progress') {
            throw new Error(
                '[UIEventBufferManager] task-progress events must use applyTaskProgress(), not enqueue()',
            );
        }
        const queue = this.fifoQueues[event.notificationType];
        if (!queue) {
            throw new Error(`[UIEventBufferManager] Unknown notification type: ${event.notificationType}`);
        }
        queue.events.push(event);
    }

    flushFifo(notificationType: 'session-state' | 'stage-snapshot'): BufferedEvent[] {
        const queue = this.fifoQueues[notificationType];
        if (!queue) {
            throw new Error(`[UIEventBufferManager] Unknown notification type: ${notificationType}`);
        }
        const drained = queue.events;
        this.fifoQueues[notificationType] = { events: [] };
        return drained;
    }

    applyTaskProgress(taskId: string, version: number, payload: unknown): BufferedEvent | undefined {
        const last = this.lastVersionByTaskId.get(taskId);
        if (last !== undefined && version <= last) {
            // stale or duplicate — drop
            return undefined;
        }
        this.lastVersionByTaskId.set(taskId, version);
        return {
            notificationType: 'task-progress',
            payload,
            timestamp: Date.now(),
        };
    }

    reset(): void {
        this.fifoQueues = {
            'session-state': { events: [] },
            'stage-snapshot': { events: [] },
        };
        this.lastVersionByTaskId = new Map();
    }
}

/**
 * Heartbeat events are processed immediately without buffering.
 */
export interface HeartbeatProcessor {
    processHeartbeat(event: { nodeId: string; heartbeatAt?: number }): void;
}

export class ImmediateHeartbeatProcessor implements HeartbeatProcessor {
    constructor(private callback: (event: { nodeId: string; heartbeatAt?: number }) => void) { }

    processHeartbeat(event: { nodeId: string; heartbeatAt?: number }): void {
        this.callback(event);
    }
}
