// EventBuffer - Interface for event buffering functionality
// Requirements: Event buffering for high-frequency events

import type { NotificationType } from '../types/EventTypes.js';

/**
 * EventBuffer - Interface for buffering high-frequency events
 * 
 * Provides buffering capabilities for high-frequency events to prevent
 * UI performance degradation and ensure reliable event delivery.
 */
export interface EventBuffer {
  /**
   * Initialize the event buffer
   * @param config - Buffer configuration
   */
  initialize(config: EventBufferConfiguration): Promise<void>;

  /**
   * Buffer an event for later delivery
   * @param notificationType - Type of notification
   * @param event - Event data to buffer
   */
  bufferEvent(notificationType: NotificationType, event: any): void;

  /**
   * Flush buffered events for a notification type
   * @param notificationType - Type of notification to flush
   * @returns Buffered events
   */
  flushEvents(notificationType: NotificationType): any[];

  /**
   * Get buffer status for a notification type
   * @param notificationType - Type of notification
   * @returns Buffer status information
   */
  getBufferStatus(notificationType: NotificationType): BufferStatus;

  /**
   * Clear all buffered events
   */
  clearAllBuffers(): void;

  /**
   * Get buffer configuration
   * @returns Current buffer configuration
   */
  getConfiguration(): EventBufferConfiguration;

  /**
   * Dispose of the event buffer
   */
  dispose(): void;
}

/**
 * EventBufferConfiguration - Configuration for event buffering
 */
export interface EventBufferConfiguration {
  /** Buffer size per notification type */
  bufferSize: number;

  /** Buffer flush interval in milliseconds */
  flushIntervalMs: number;

  /** Enable compression for buffered events */
  enableCompression: boolean;

  /** Maximum retention time for buffered events */
  maxRetentionMs: number;
}

/**
 * BufferStatus - Status information for event buffers
 */
export interface BufferStatus {
  /** Current number of buffered events */
  currentSize: number;

  /** Maximum buffer capacity */
  maxSize: number;

  /** Buffer utilization percentage */
  utilizationPercent: number;

  /** Number of events dropped due to overflow */
  droppedEvents: number;

  /** Last flush timestamp */
  lastFlushTime: number;
}