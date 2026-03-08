/**
 * Worker-side Unconditional Event Streaming
 * 
 * Implements unconditional event streaming with distributed sequence numbering
 * for reliable event delivery regardless of UI state.
 * Events are not buffered when UI is disconnected.
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

// Distributed sequence number generator
interface SeqNumGenerator {
    workerIndex: number;
    totalWorkers: number;
    eventCount: number;
}

/**
 * Event delivery monitoring and logging utilities
 * Provides metrics for event delivery latency and buffer utilization
 */

/**
 * Memory management configuration for EventDeliveryMonitor
 */
interface MemoryManagementConfig {
    maxLatencyEntries: number;
    cleanupThreshold: number;
    memoryWarningThreshold: number;
    memoryAlertThreshold: number;
}

/**
 * Memory usage statistics
 */
interface MemoryUsageStats {
    latencyEntriesCount: number;
    estimatedMemoryUsage: number;
    isWarningLevel: boolean;
    isAlertLevel: boolean;
}

/**
 * Event delivery metrics
 */
export interface EventDeliveryMetrics {
    totalEventsEmitted: number;
    totalEventsBuffered: number;
    totalEventsFlushed: number;
    averageDeliveryLatency: number;
    bufferUtilization: Record<NotificationType, number>;
    lastEmissionTimestamp: number;
    lastFlushTimestamp: number;
    memoryUsage: MemoryUsageStats;
}

type NotificationType = 'session-state' | 'stage-snapshot' | 'task-progress' | 'worker-log' | 'critical-error';

interface SequencedEvent {
    seqNum: number;
    notificationType: NotificationType;
    payload: any;
    timestamp: number;
}

/**
 * Event delivery monitor for tracking performance and debugging
 */
export class EventDeliveryMonitor {
    private static readonly DEFAULT_CONFIG: MemoryManagementConfig = {
        maxLatencyEntries: 1000,
        cleanupThreshold: 800,
        memoryWarningThreshold: 500,
        memoryAlertThreshold: 900,
    };

    private emissionCount = 0;
    private bufferedCount = 0;
    private flushedCount = 0;
    private deliveryLatencies: number[] = [];
    private bufferSizes: Record<NotificationType, number> = {
        'session-state': 0,
        'stage-snapshot': 0,
        'task-progress': 0,
        'worker-log': 0,
        'critical-error': 0,
    };
    private lastEmissionTime = 0;
    private lastFlushTime = 0;
    private config: MemoryManagementConfig;

    constructor(config?: Partial<MemoryManagementConfig>) {
        this.config = { ...EventDeliveryMonitor.DEFAULT_CONFIG, ...config };
    }

    /**
     * Log event emission from Worker side
     */
    logEventEmission(event: SequencedEvent): void {
        this.emissionCount++;
        this.lastEmissionTime = Date.now();
        
        console.log('[EventDeliveryMonitor] Event emitted from Worker', {
            seqNum: event.seqNum,
            notificationType: event.notificationType,
            timestamp: event.timestamp,
            emissionTime: this.lastEmissionTime,
            totalEmitted: this.emissionCount,
        });
    }

    /**
     * Log event buffering on UI side
     */
    logEventBuffering(event: SequencedEvent, bufferSize: number): void {
        this.bufferedCount++;
        this.bufferSizes[event.notificationType] = bufferSize;
        
        console.log('[EventDeliveryMonitor] Event buffered on UI side', {
            seqNum: event.seqNum,
            notificationType: event.notificationType,
            bufferSize,
            totalBuffered: this.bufferedCount,
            deliveryLatency: Date.now() - event.timestamp,
        });
    }

    /**
     * Log event reception and processing on UI side
     */
    logEventReception(events: SequencedEvent[], processingStatus: 'success' | 'error', error?: unknown): void {
        this.flushedCount += events.length;
        this.lastFlushTime = Date.now();
        
        // Calculate delivery latencies
        const latencies = events.map(event => this.lastFlushTime - event.timestamp);
        this.deliveryLatencies.push(...latencies);
        
        // Perform memory management
        this.performMemoryManagement();

        console.log('[EventDeliveryMonitor] Events processed on UI side', {
            eventCount: events.length,
            processingStatus,
            totalFlushed: this.flushedCount,
            latencies,
            averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
        });

        // Update buffer sizes after flush
        const eventsByType = events.reduce((acc, event) => {
            acc[event.notificationType] = (acc[event.notificationType] || 0) + 1;
            return acc;
        }, {} as Record<NotificationType, number>);

        for (const [type, count] of Object.entries(eventsByType)) {
            this.bufferSizes[type as NotificationType] = Math.max(0, this.bufferSizes[type as NotificationType] - count);
        }
    }

    /**
     * Perform memory management and cleanup
     */
    private performMemoryManagement(): void {
        const memoryStats = this.getMemoryUsageStats();

        // Check if cleanup is needed
        if (this.deliveryLatencies.length > this.config.maxLatencyEntries) {
            const beforeCleanup = this.deliveryLatencies.length;
            this.cleanupOldLatencies();
            const afterCleanup = this.deliveryLatencies.length;
            
            console.warn('[EventDeliveryMonitor] Memory cleanup performed', {
                entriesRemoved: beforeCleanup - afterCleanup,
                remainingEntries: afterCleanup,
                estimatedMemoryUsage: this.getMemoryUsageStats().estimatedMemoryUsage,
            });
        }

        // Check memory usage levels
        if (memoryStats.isAlertLevel) {
            console.error('[EventDeliveryMonitor] Memory usage alert', {
                latencyEntriesCount: memoryStats.latencyEntriesCount,
                estimatedMemoryUsage: memoryStats.estimatedMemoryUsage,
                threshold: this.config.memoryAlertThreshold,
            });
        } else if (memoryStats.isWarningLevel) {
            console.warn('[EventDeliveryMonitor] Memory usage warning', {
                latencyEntriesCount: memoryStats.latencyEntriesCount,
                estimatedMemoryUsage: memoryStats.estimatedMemoryUsage,
                threshold: this.config.memoryWarningThreshold,
            });
        }
    }

    /**
     * Clean up old latency data
     */
    private cleanupOldLatencies(): void {
        const targetSize = this.config.cleanupThreshold;
        if (this.deliveryLatencies.length > targetSize) {
            // Keep only the most recent entries
            this.deliveryLatencies = this.deliveryLatencies.slice(-targetSize);
        }
    }

    /**
     * Get memory usage statistics
     */
    private getMemoryUsageStats(): MemoryUsageStats {
        const latencyEntriesCount = this.deliveryLatencies.length;
        // Estimate memory usage: each number is ~8 bytes + array overhead
        const estimatedMemoryUsage = latencyEntriesCount * 8 + 64; // bytes
        
        return {
            latencyEntriesCount,
            estimatedMemoryUsage,
            isWarningLevel: latencyEntriesCount >= this.config.memoryWarningThreshold,
            isAlertLevel: latencyEntriesCount >= this.config.memoryAlertThreshold,
        };
    }

    /**
     * Get current delivery metrics
     */
    getMetrics(): EventDeliveryMetrics {
        const averageLatency = this.deliveryLatencies.length > 0
            ? this.deliveryLatencies.reduce((sum, lat) => sum + lat, 0) / this.deliveryLatencies.length
            : 0;

        return {
            totalEventsEmitted: this.emissionCount,
            totalEventsBuffered: this.bufferedCount,
            totalEventsFlushed: this.flushedCount,
            averageDeliveryLatency: averageLatency,
            bufferUtilization: { ...this.bufferSizes },
            lastEmissionTimestamp: this.lastEmissionTime,
            lastFlushTimestamp: this.lastFlushTime,
            memoryUsage: this.getMemoryUsageStats(),
        };
    }

    /**
     * Force memory cleanup
     */
    forceCleanup(): void {
        this.cleanupOldLatencies();
        
        console.log('[EventDeliveryMonitor] Forced memory cleanup completed', {
            remainingEntries: this.deliveryLatencies.length,
            memoryUsage: this.getMemoryUsageStats(),
        });
    }

    /**
     * Update memory management configuration
     */
    updateConfig(newConfig: Partial<MemoryManagementConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Perform immediate cleanup if new limits are exceeded
        if (this.deliveryLatencies.length > this.config.maxLatencyEntries) {
            this.performMemoryManagement();
        }
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.emissionCount = 0;
        this.bufferedCount = 0;
        this.flushedCount = 0;
        this.deliveryLatencies = [];
        this.bufferSizes = {
            'session-state': 0,
            'stage-snapshot': 0,
            'task-progress': 0,
            'worker-log': 0,
            'critical-error': 0,
        };
        this.lastEmissionTime = 0;
        this.lastFlushTime = 0;
    }
}

/**
 * Global event delivery monitor instance
 */
export const eventDeliveryMonitor = new EventDeliveryMonitor();

class DistributedSeqNumGenerator {
    private generators = new Map<string, SeqNumGenerator>();

    constructor(private defaultTotalWorkers: number = 1) { }

    /**
     * Initialize sequence number generator for a specific event type and node
     */
    initializeGenerator(nodeId: NodeId, eventType: string, workerIndex: number = 0, totalWorkers?: number): void {
        const key = `${nodeId}:${eventType}`;
        this.generators.set(key, {
            workerIndex,
            totalWorkers: totalWorkers ?? this.defaultTotalWorkers,
            eventCount: 0,
        });
    }

    /**
     * Generate next sequence number for distributed workers
     * Formula: workerIndex + (eventCount * totalWorkers)
     */
    nextSeqNum(nodeId: NodeId, eventType: string): number {
        const key = `${nodeId}:${eventType}`;
        const generator = this.generators.get(key);

        if (!generator) {
            // Auto-initialize with default values
            this.initializeGenerator(nodeId, eventType);
            return this.nextSeqNum(nodeId, eventType);
        }

        const seqNum = generator.workerIndex + (generator.eventCount * generator.totalWorkers);
        generator.eventCount++;

        return seqNum;
    }

    /**
     * Reset sequence number generator for a node (e.g., on session restart)
     */
    resetGenerator(nodeId: NodeId, eventType?: string): void {
        if (eventType) {
            const key = `${nodeId}:${eventType}`;
            const generator = this.generators.get(key);
            if (generator) {
                generator.eventCount = 0;
            }
        } else {
            // Reset all generators for this node
            for (const [key, generator] of this.generators.entries()) {
                if (key.startsWith(`${nodeId}:`)) {
                    generator.eventCount = 0;
                }
            }
        }
    }

    /**
     * Clean up generators for a node (e.g., on session cleanup)
     */
    cleanupGenerators(nodeId: NodeId): void {
        const keysToDelete: string[] = [];
        for (const key of this.generators.keys()) {
            if (key.startsWith(`${nodeId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.generators.delete(key));
    }
}

// Unconditional event streamer (no buffering)
interface EventSubscriber {
    callback: (event: any) => void;
    eventType: string;
}

class UnconditionalEventStreamer {
    private subscribers = new Map<NodeId, Set<EventSubscriber>>();
    private seqNumGenerator = new DistributedSeqNumGenerator();

    /**
     * Configure distributed sequence numbering for parallel workers
     */
    configureDistributedSeqNum(nodeId: NodeId, workerIndex: number, totalWorkers: number): void {
        // Initialize generators for all buffered event types
        const eventTypes = ['session-state', 'stage-snapshot', 'task-progress', 'worker-log', 'critical-error'];
        eventTypes.forEach(eventType => {
            this.seqNumGenerator.initializeGenerator(nodeId, eventType, workerIndex, totalWorkers);
        });
    }

    /**
     * Emit event unconditionally (regardless of UI state)
     * Events are delivered to current subscribers only - no buffering
     */
    emitEvent(
        nodeId: NodeId,
        eventType: 'session-state' | 'stage-snapshot' | 'task-progress' | 'worker-log' | 'critical-error',
        event: SessionStateChangeEvent | StageSnapshotEvent | TaskProgressEvent | WorkerLogEvent | CriticalErrorEvent
    ): void {
        const seqNum = this.seqNumGenerator.nextSeqNum(nodeId, eventType);
        const sequencedEvent: SequencedEvent = {
            seqNum,
            notificationType: eventType,
            payload: event,
            timestamp: Date.now(),
        };

        // Log event emission for monitoring
        eventDeliveryMonitor.logEventEmission(sequencedEvent);

        const nodeSubscribers = this.subscribers.get(nodeId);
        if (!nodeSubscribers) {
            // No subscribers - event is discarded (no buffering)
            return;
        }

        // Notify current subscribers for this event type
        nodeSubscribers.forEach(subscriber => {
            if (subscriber.eventType === eventType) {
                try {
                    subscriber.callback(sequencedEvent);
                } catch (error) {
                    // Exception isolation - don't affect other subscribers
                    console.error('[UnconditionalEventStreamer] Subscriber callback failed', {
                        nodeId,
                        eventType,
                        subscriberError: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : error
                    });
                    // Do not re-throw (isolation)
                }
            }
        });
    }

    /**
     * Process heartbeat events immediately (no buffering, no seqNum)
     */
    emitHeartbeat(nodeId: NodeId, event: SessionHeartbeatEvent): void {
        const nodeSubscribers = this.subscribers.get(nodeId);
        if (!nodeSubscribers) {
            // No subscribers - event is discarded
            return;
        }

        // Notify current heartbeat subscribers
        nodeSubscribers.forEach(subscriber => {
            if (subscriber.eventType === 'heartbeat') {
                try {
                    subscriber.callback(event);
                } catch (error) {
                    // Exception isolation - don't affect other subscribers
                    console.error('[UnconditionalEventStreamer] Heartbeat subscriber callback failed', {
                        nodeId,
                        eventType: 'heartbeat',
                        subscriberError: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : error
                    });
                    // Do not re-throw (isolation)
                }
            }
        });
    }

    /**
     * Subscribe to events for a node (UI connects)
     */
    subscribe(nodeId: NodeId, eventType: string, callback: (event: any) => void): () => void {
        if (!this.subscribers.has(nodeId)) {
            this.subscribers.set(nodeId, new Set());
        }

        const nodeSubscribers = this.subscribers.get(nodeId)!;
        const subscriber: EventSubscriber = { callback, eventType };
        nodeSubscribers.add(subscriber);

        // Return unsubscribe function
        return () => {
            nodeSubscribers.delete(subscriber);
            if (nodeSubscribers.size === 0) {
                this.subscribers.delete(nodeId);
            }
        };
    }

    /**
     * Reset sequence numbers for a node (e.g., on session restart)
     */
    resetSequenceNumbers(nodeId: NodeId): void {
        this.seqNumGenerator.resetGenerator(nodeId);
    }

    /**
     * Clean up all data for a node (e.g., on session completion)
     */
    cleanup(nodeId: NodeId): void {
        this.subscribers.delete(nodeId);
        this.seqNumGenerator.cleanupGenerators(nodeId);
    }
}

// Singleton instance for worker-wide event streaming
export const unconditionalEventStreamer = new UnconditionalEventStreamer();

// Export types for external use
export type { SeqNumGenerator, NotificationType, SequencedEvent };
export { DistributedSeqNumGenerator };