/**
 * UI-side event buffering for Worker→UI event delivery.
 *
 * Design:
 * - session-state / stage-snapshot: simple FIFO queue, no ordering constraint
 *   (Worker:UI = 1:1, so events arrive in emission order)
 * - task-progress: version-based ordering only — drop stale (lower version) and
 *   drop any update after value=100 (completed/skipped/failed final state)
 * - heartbeat: immediate pass-through, no buffering
 *
 * seqNum (distributed sequence number from Worker) is NOT used for ordering here.
 * It is attached to task-progress events solely so the caller can perform
 * version-based deduplication across parallel stage Workers.
 */

export type NotificationType = 'session-state' | 'stage-snapshot' | 'task-progress';

/** A buffered event carrying an optional version for task-progress ordering. */
export interface BufferedEvent {
    /** version is only meaningful for task-progress events */
    version: number | undefined;
    notificationType: NotificationType;
    payload: unknown;
    timestamp: number;
}

export interface FifoEventQueue {
    events: BufferedEvent[];
}

export interface TaskProgressState {
    lastAppliedVersion: number | undefined;
    /** true once a value=100 event has been applied (final state reached) */
    finalReached: boolean;
}

export interface EventBufferManager {
    enqueue(event: BufferedEvent): void;
    /** Flush all queued events for session-state or stage-snapshot (FIFO, no filtering). */
    flushFifo(notificationType: 'session-state' | 'stage-snapshot'): BufferedEvent[];
    /**
     * Apply version-based ordering for task-progress.
     * Returns the event if it should be applied, undefined if it should be dropped.
     */
    applyTaskProgress(event: BufferedEvent): BufferedEvent | undefined;
    reset(): void;
}

/**
 * Manages UI-side event queues.
 *
 * session-state / stage-snapshot: FIFO — all events are returned in order.
 * task-progress: version gate — stale and post-final events are dropped.
 */
export class UIEventBufferManager implements EventBufferManager {
    private fifoQueues: Record<'session-state' | 'stage-snapshot', FifoEventQueue> = {
        'session-state': { events: [] },
        'stage-snapshot': { events: [] },
    };

    private taskProgressState: TaskProgressState = {
        lastAppliedVersion: undefined,
        finalReached: false,
    };

    enqueue(event: BufferedEvent): void {
        if (event.notificationType === 'task-progress') {
            throw new Error(
                '[UIEventBufferManager] task-progress must be applied via applyTaskProgress, not enqueue',
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

    /**
     * Version-based gate for task-progress events.
     *
     * Rules:
     * 1. If finalReached (value=100 already applied), drop all subsequent events.
     * 2. If version is undefined, always accept (no ordering info available).
     * 3. If version <= lastAppliedVersion, drop (stale / duplicate).
     * 4. Otherwise accept and update lastAppliedVersion.
     * 5. After accepting, if the event's progress value is 100, set finalReached=true.
     */
    applyTaskProgress(event: BufferedEvent): BufferedEvent | undefined {
        if (event.notificationType !== 'task-progress') {
            throw new Error(
                `[UIEventBufferManager] applyTaskProgress called with wrong type: ${event.notificationType}`,
            );
        }

        // Rule 1: final state already reached — drop everything after
        if (this.taskProgressState.finalReached) {
            return undefined;
        }

        const { version } = event;

        // Rule 2: no version info — accept unconditionally
        if (version === undefined) {
            this.maybeMarkFinal(event);
            return event;
        }

        if (!Number.isFinite(version) || version < 0) {
            throw new Error(`[UIEventBufferManager] Invalid task-progress version: ${version}`);
        }

        const last = this.taskProgressState.lastAppliedVersion;

        // Rule 3: stale or duplicate
        if (last !== undefined && version <= last) {
            return undefined;
        }

        // Rule 4: accept
        this.taskProgressState.lastAppliedVersion = version;

        // Rule 5: mark final if value=100
        this.maybeMarkFinal(event);

        return event;
    }

    private maybeMarkFinal(event: BufferedEvent): void {
        const payload = event.payload as { value?: unknown } | null | undefined;
        if (payload !== null && payload !== undefined && payload.value === 100) {
            this.taskProgressState.finalReached = true;
        }
    }

    reset(): void {
        this.fifoQueues = {
            'session-state': { events: [] },
            'stage-snapshot': { events: [] },
        };
        this.taskProgressState = {
            lastAppliedVersion: undefined,
            finalReached: false,
        };
    }

    /** Exposed for testing only. */
    getTaskProgressState(): Readonly<TaskProgressState> {
        return { ...this.taskProgressState };
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
