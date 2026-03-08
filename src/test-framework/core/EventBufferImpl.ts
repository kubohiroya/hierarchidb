// EventBufferImpl - Implementation of event buffering functionality
// Requirements: Event buffering for high-frequency events

import type { EventBuffer, EventBufferConfiguration, BufferStatus } from './EventBuffer.js';
import type { NotificationType } from '../types/EventTypes.js';

/**
 * EventBufferImpl - Concrete implementation of event buffering
 * 
 * Provides buffering capabilities for high-frequency events to prevent
 * UI performance degradation and ensure reliable event delivery.
 */
export class EventBufferImpl implements EventBuffer {
  private configuration!: EventBufferConfiguration;
  private buffers: Map<NotificationType, any[]> = new Map();
  private bufferStats: Map<NotificationType, BufferStatus> = new Map();
  private isInitialized = false;

  /**
   * Initialize the event buffer
   */
  async initialize(config: EventBufferConfiguration): Promise<void> {
    if (!config) {
      throw new Error('Contract violation: configuration must be provided');
    }

    this.configuration = { ...config };
    
    // Initialize buffers for all notification types
    const notificationTypes: NotificationType[] = [
      'session-state',
      'task-progress',
      'stage-snapshot',
      'worker-log',
      'critical-error',
      'heartbeat'
    ];

    for (const type of notificationTypes) {
      this.buffers.set(type, []);
      this.bufferStats.set(type, {
        currentSize: 0,
        maxSize: config.bufferSize,
        utilizationPercent: 0,
        droppedEvents: 0,
        lastFlushTime: Date.now()
      });
    }

    this.isInitialized = true;
    console.log('EventBuffer initialized successfully');
  }

  /**
   * Buffer an event for later delivery
   */
  bufferEvent(notificationType: NotificationType, event: any): void {
    this.ensureInitialized();

    const buffer = this.buffers.get(notificationType);
    const stats = this.bufferStats.get(notificationType);

    if (!buffer || !stats) {
      throw new Error(`Contract violation: unsupported notification type: ${notificationType}`);
    }

    // Check buffer capacity
    if (buffer.length >= this.configuration.bufferSize) {
      // Drop oldest event to make room
      buffer.shift();
      stats.droppedEvents++;
    }

    // Add new event
    buffer.push({
      ...event,
      bufferedAt: Date.now()
    });

    // Update stats
    stats.currentSize = buffer.length;
    stats.utilizationPercent = (buffer.length / stats.maxSize) * 100;
  }

  /**
   * Flush buffered events for a notification type
   */
  flushEvents(notificationType: NotificationType): any[] {
    this.ensureInitialized();

    const buffer = this.buffers.get(notificationType);
    const stats = this.bufferStats.get(notificationType);

    if (!buffer || !stats) {
      throw new Error(`Contract violation: unsupported notification type: ${notificationType}`);
    }

    // Get all buffered events
    const events = [...buffer];
    
    // Clear buffer
    buffer.length = 0;
    
    // Update stats
    stats.currentSize = 0;
    stats.utilizationPercent = 0;
    stats.lastFlushTime = Date.now();

    return events;
  }

  /**
   * Get buffer status for a notification type
   */
  getBufferStatus(notificationType: NotificationType): BufferStatus {
    this.ensureInitialized();

    const stats = this.bufferStats.get(notificationType);
    if (!stats) {
      throw new Error(`Contract violation: unsupported notification type: ${notificationType}`);
    }

    return { ...stats };
  }

  /**
   * Clear all buffered events
   */
  clearAllBuffers(): void {
    this.ensureInitialized();

    for (const [type, buffer] of this.buffers.entries()) {
      buffer.length = 0;
      
      const stats = this.bufferStats.get(type)!;
      stats.currentSize = 0;
      stats.utilizationPercent = 0;
      stats.lastFlushTime = Date.now();
    }
  }

  /**
   * Get buffer configuration
   */
  getConfiguration(): EventBufferConfiguration {
    this.ensureInitialized();
    return { ...this.configuration };
  }

  /**
   * Dispose of the event buffer
   */
  dispose(): void {
    if (!this.isInitialized) {
      return;
    }

    this.clearAllBuffers();
    this.buffers.clear();
    this.bufferStats.clear();
    this.isInitialized = false;
    
    console.log('EventBuffer disposed');
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('EventBuffer must be initialized before use');
    }
  }
}