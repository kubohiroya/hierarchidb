/**
 * UnconditionalEventStreamer Adapter
 * 
 * Adapter for integrating with existing UnconditionalEventStreamer system.
 * Provides type-safe wrapper and enhanced functionality for test framework.
 */

import type { 
  UnconditionalEventStreamerInterface,
  EventSubscription,
  EventEmissionResult 
} from '../types/IntegrationTypes.js';

/**
 * Adapter for UnconditionalEventStreamer integration
 * 
 * Wraps the existing UnconditionalEventStreamer with enhanced functionality
 * for test framework requirements including event tracking and validation.
 */
export class UnconditionalEventStreamerAdapter implements UnconditionalEventStreamerInterface {
  private readonly eventStreamer: any; // Existing UnconditionalEventStreamer instance
  private readonly subscriptions = new Map<string, Set<() => void>>();
  private readonly eventCounts = new Map<string, number>();

  constructor(eventStreamer: any) {
    this.eventStreamer = eventStreamer;
  }

  /**
   * Subscribe to events with enhanced tracking
   */
  subscribe(eventType: string, callback: (event: unknown) => void): () => void {
    // Track subscription for cleanup
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    // Create wrapped callback for event counting
    const wrappedCallback = (event: unknown) => {
      this.incrementEventCount(eventType);
      callback(event);
    };

    // Subscribe to actual event streamer
    const unsubscribe = this.eventStreamer.subscribe(eventType, wrappedCallback);

    // Track unsubscribe function
    const subscriptionSet = this.subscriptions.get(eventType)!;
    subscriptionSet.add(unsubscribe);

    // Return enhanced unsubscribe function
    return () => {
      unsubscribe();
      subscriptionSet.delete(unsubscribe);
      if (subscriptionSet.size === 0) {
        this.subscriptions.delete(eventType);
      }
    };
  }

  /**
   * Emit events with validation
   */
  emit(eventType: string, payload: unknown): void {
    // Validate payload if needed
    this.validatePayload(eventType, payload);
    
    // Emit to actual event streamer
    this.eventStreamer.emit(eventType, payload);
    
    // Track emission
    this.incrementEventCount(`${eventType}:emitted`);
  }

  /**
   * Get subscriber count for event type
   */
  getSubscriberCount(eventType: string): number {
    const subscriptionSet = this.subscriptions.get(eventType);
    return subscriptionSet ? subscriptionSet.size : 0;
  }

  /**
   * Get event statistics for testing
   */
  getEventStatistics(): Record<string, number> {
    return Object.fromEntries(this.eventCounts);
  }

  /**
   * Reset event statistics
   */
  resetEventStatistics(): void {
    this.eventCounts.clear();
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    for (const [eventType, subscriptionSet] of this.subscriptions) {
      for (const unsubscribe of subscriptionSet) {
        unsubscribe();
      }
    }
    this.subscriptions.clear();
    this.eventCounts.clear();
  }

  /**
   * Increment event count for tracking
   */
  private incrementEventCount(key: string): void {
    const current = this.eventCounts.get(key) || 0;
    this.eventCounts.set(key, current + 1);
  }

  /**
   * Validate event payload (can be extended for specific validation rules)
   */
  private validatePayload(eventType: string, payload: unknown): void {
    // Basic validation - can be extended based on requirements
    if (payload === undefined) {
      throw new Error(`Invalid payload for event type ${eventType}: payload is undefined`);
    }
    
    // Add specific validation rules for known event types
    switch (eventType) {
      case 'session-state':
        this.validateSessionStatePayload(payload);
        break;
      case 'task-progress':
        this.validateTaskProgressPayload(payload);
        break;
      case 'stage-snapshot':
        this.validateStageSnapshotPayload(payload);
        break;
      // Add more validation rules as needed
    }
  }

  /**
   * Validate session state payload
   */
  private validateSessionStatePayload(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Session state payload must be an object');
    }
    
    const state = payload as Record<string, unknown>;
    if (typeof state.sessionId !== 'string') {
      throw new Error('Session state payload must have a string sessionId');
    }
  }

  /**
   * Validate task progress payload
   */
  private validateTaskProgressPayload(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Task progress payload must be an object');
    }
    
    const progress = payload as Record<string, unknown>;
    if (typeof progress.taskId !== 'string') {
      throw new Error('Task progress payload must have a string taskId');
    }
    
    if (typeof progress.progress !== 'number' || progress.progress < 0 || progress.progress > 100) {
      throw new Error('Task progress payload must have a progress number between 0 and 100');
    }
  }

  /**
   * Validate stage snapshot payload
   */
  private validateStageSnapshotPayload(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Stage snapshot payload must be an object');
    }
    
    const snapshot = payload as Record<string, unknown>;
    if (typeof snapshot.nodeId !== 'string') {
      throw new Error('Stage snapshot payload must have a string nodeId');
    }
    
    if (typeof snapshot.stage !== 'string') {
      throw new Error('Stage snapshot payload must have a string stage');
    }
  }
}