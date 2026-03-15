/**
 * Worker-side Unconditional Event Streaming
 *
 * Delivers events directly to current subscribers without buffering.
 * Events emitted when no subscriber is registered are discarded.
 * No sequence numbering - ordering is guaranteed by the single-threaded
 * Worker execution model.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type {
    SessionStateChangeEvent,
    StageSnapshotEvent,
    TaskProgressEvent,
    SessionHeartbeatEvent,
    WorkerLogEvent,
    CriticalErrorEvent,
} from '~/common/types/session-events';

type NotificationType =
    | 'session-state'
    | 'stage-snapshot'
    | 'task-progress'
    | 'worker-log'
    | 'critical-error'
    | 'heartbeat';

type EventPayload =
    | SessionStateChangeEvent
    | StageSnapshotEvent
    | TaskProgressEvent
    | SessionHeartbeatEvent
    | WorkerLogEvent
    | CriticalErrorEvent;

interface EventSubscriber {
    eventType: NotificationType;
    callback: (event: EventPayload) => void;
}

class UnconditionalEventStreamer {
    private readonly subscribers = new Map<NodeId, Set<EventSubscriber>>();

    /** Deliver an event to all subscribers registered for the given node and event type. */
    private deliver(nodeId: NodeId, eventType: NotificationType, event: EventPayload): void {
        const nodeSubscribers = this.subscribers.get(nodeId);
        if (!nodeSubscribers) return;

        for (const subscriber of nodeSubscribers) {
            if (subscriber.eventType !== eventType) continue;
            try {
                subscriber.callback(event);
            } catch (error) {
                console.error('[UnconditionalEventStreamer] subscriber callback failed', {
                    nodeId,
                    eventType,
                    error: error instanceof Error
                        ? { name: error.name, message: error.message, stack: error.stack }
                        : error,
                });
            }
        }
    }

    /**
     * Emit an event to all current subscribers for the given node and event type.
     * If no subscriber is registered the event is silently discarded (no buffering).
     */
    emitEvent(
        nodeId: NodeId,
        eventType: Exclude<NotificationType, 'heartbeat'>,
        event: Exclude<EventPayload, SessionHeartbeatEvent>,
    ): void {
        this.deliver(nodeId, eventType, event);
    }

    /**
     * Emit a heartbeat event to all current subscribers for the given node.
     */
    emitHeartbeat(nodeId: NodeId, event: SessionHeartbeatEvent): void {
        this.deliver(nodeId, 'heartbeat', event);
    }

    /**
     * Subscribe to events of the given type for a node.
     * Returns an unsubscribe function.
     */
    subscribe(
        nodeId: NodeId,
        eventType: NotificationType,
        callback: (event: EventPayload) => void,
    ): () => void {
        let nodeSubscribers = this.subscribers.get(nodeId);
        if (!nodeSubscribers) {
            nodeSubscribers = new Set();
            this.subscribers.set(nodeId, nodeSubscribers);
        }

        const subscriber: EventSubscriber = { eventType, callback };
        nodeSubscribers.add(subscriber);

        return () => {
            nodeSubscribers.delete(subscriber);
            if (nodeSubscribers.size === 0) {
                this.subscribers.delete(nodeId);
            }
        };
    }

    /**
     * Remove all subscribers for a node (e.g. on session completion).
     */
    cleanup(nodeId: NodeId): void {
        this.subscribers.delete(nodeId);
    }
}

/** Singleton instance for worker-wide event streaming. */
export const unconditionalEventStreamer = new UnconditionalEventStreamer();

export type { NotificationType, EventPayload };
