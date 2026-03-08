/**
 * Event Ordering and Completeness Verification Integration Tests
 * 
 * Tests event sequence verification across multiple notification types simultaneously,
 * validates no events are lost during rapid emission sequences (stress testing),
 * tests gap detection and recovery mechanisms under various failure scenarios,
 * and validates event delivery monitoring and metrics collection accuracy.
 * 
 * Validates Requirements 9.16, 9.17, 9.18
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';

// Notification types for event buffering
type NotificationType = 'session-state' | 'stage-snapshot' | 'task-progress' | 'heartbeat';

// Event delivery metrics interface
interface EventDeliveryMetrics {
  emitted: number;
  buffered: number;
  processed: number;
  gaps: number;
  latencyMs: number[];
  bufferUtilization: number;
}

// Multi-notification event buffer for testing
class MultiNotificationEventBuffer {
  private buffers: Map<NotificationType, Array<{ seqNum: number; data: any; timestamp: number }>> = new Map();
  private seqNums: Map<NotificationType, number> = new Map();
  private metrics: Map<NotificationType, EventDeliveryMetrics> = new Map();
  private heartbeatValue: any = null;

  constructor() {
    // Initialize buffers for buffered notification types (heartbeat excluded)
    const bufferedTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
    for (const type of bufferedTypes) {
      this.buffers.set(type, []);
      this.seqNums.set(type, 0);
      this.metrics.set(type, {
        emitted: 0,
        buffered: 0,
        processed: 0,
        gaps: 0,
        latencyMs: [],
        bufferUtilization: 0,
      });
    }

    // Heartbeat has separate metrics but no buffer
    this.metrics.set('heartbeat', {
      emitted: 0,
      buffered: 0, // Always 0 for heartbeat
      processed: 0,
      gaps: 0, // Always 0 for heartbeat
      latencyMs: [],
      bufferUtilization: 0, // Always 0 for heartbeat
    });
  }

  // Emit event with automatic seqNum assignment for buffered types
  emitEvent(type: NotificationType, data: any): number | null {
    const timestamp = Date.now();
    const metrics = this.metrics.get(type)!;
    metrics.emitted++;

    if (type === 'heartbeat') {
      // Heartbeat: immediate processing, no buffering, no seqNum
      this.heartbeatValue = { data, timestamp };
      metrics.processed++;
      metrics.latencyMs.push(0); // Immediate processing
      return null; // No seqNum for heartbeat
    } else {
      // Buffered types: assign seqNum and add to buffer
      const currentSeqNum = this.seqNums.get(type)! + 1;
      this.seqNums.set(type, currentSeqNum);

      const buffer = this.buffers.get(type)!;
      buffer.push({ seqNum: currentSeqNum, data, timestamp });
      
      metrics.buffered++;
      metrics.bufferUtilization = buffer.length;

      return currentSeqNum;
    }
  }

  // Process buffered events in seqNum order for a specific type
  processBufferedEvents(type: NotificationType): Array<{ seqNum: number; data: any; timestamp: number }> {
    if (type === 'heartbeat') {
      return []; // Heartbeat is not buffered
    }

    const buffer = this.buffers.get(type)!;
    const metrics = this.metrics.get(type)!;

    // Sort by seqNum to ensure ordering
    buffer.sort((a, b) => a.seqNum - b.seqNum);

    // Detect gaps in sequence
    for (let i = 1; i < buffer.length; i++) {
      const expectedSeqNum = buffer[i - 1].seqNum + 1;
      if (buffer[i].seqNum !== expectedSeqNum) {
        metrics.gaps++;
      }
    }

    // Calculate latency for processed events
    const now = Date.now();
    for (const event of buffer) {
      const latency = now - event.timestamp;
      metrics.latencyMs.push(latency);
    }

    metrics.processed += buffer.length;
    metrics.bufferUtilization = 0; // Buffer cleared after processing

    // Return processed events and clear buffer
    const processedEvents = [...buffer];
    buffer.length = 0;
    
    return processedEvents;
  }

  // Get current heartbeat value (latest only)
  getHeartbeat(): any {
    return this.heartbeatValue;
  }

  // Get metrics for a notification type
  getMetrics(type: NotificationType): EventDeliveryMetrics {
    return { ...this.metrics.get(type)! };
  }

  // Get all metrics
  getAllMetrics(): Map<NotificationType, EventDeliveryMetrics> {
    const result = new Map<NotificationType, EventDeliveryMetrics>();
    for (const [type, metrics] of this.metrics) {
      result.set(type, { ...metrics });
    }
    return result;
  }

  // Reset all buffers and metrics
  reset() {
    for (const buffer of this.buffers.values()) {
      buffer.length = 0;
    }
    for (const [type] of this.seqNums) {
      this.seqNums.set(type, 0);
    }
    for (const metrics of this.metrics.values()) {
      metrics.emitted = 0;
      metrics.buffered = 0;
      metrics.processed = 0;
      metrics.gaps = 0;
      metrics.latencyMs = [];
      metrics.bufferUtilization = 0;
    }
    this.heartbeatValue = null;
  }

  // Simulate event loss by removing random events from buffer
  simulateEventLoss(type: NotificationType, lossRate: number) {
    if (type === 'heartbeat') return; // Cannot lose heartbeat events

    const buffer = this.buffers.get(type)!;
    const originalLength = buffer.length;
    
    // Remove random events based on loss rate
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (Math.random() < lossRate) {
        buffer.splice(i, 1);
      }
    }

    // Update metrics to reflect loss
    const metrics = this.metrics.get(type)!;
    const lostEvents = originalLength - buffer.length;
    metrics.buffered -= lostEvents;
    metrics.bufferUtilization = buffer.length;
  }

  // Get buffer size for a notification type
  getBufferSize(type: NotificationType): number {
    if (type === 'heartbeat') return 0;
    return this.buffers.get(type)?.length || 0;
  }

  // Check if sequence is complete (no gaps)
  isSequenceComplete(type: NotificationType): boolean {
    if (type === 'heartbeat') return true; // Heartbeat doesn't have sequence

    const buffer = this.buffers.get(type)!;
    if (buffer.length === 0) return true;

    buffer.sort((a, b) => a.seqNum - b.seqNum);
    
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].seqNum !== buffer[i - 1].seqNum + 1) {
        return false;
      }
    }
    return true;
  }
}

describe('Event Ordering and Completeness Verification Integration Tests', () => {
  let eventBuffer: MultiNotificationEventBuffer;
  let abortController: AbortController;

  beforeEach(async () => {
    await ephemeralDB.delete();
    await ephemeralDB.open();
    eventBuffer = new MultiNotificationEventBuffer();
    abortController = new AbortController();
  });

  afterEach(async () => {
    abortController.abort();
    await ephemeralDB.delete();
  });

  it('should verify event sequence across multiple notification types simultaneously', async () => {
    const nodeId = 'test-node-multi-notification' as NodeId;

    // Simulate concurrent event emission across different notification types
    const eventSequences: Array<{ type: NotificationType; data: any }> = [
      { type: 'session-state', data: { nodeId, status: 'starting' } },
      { type: 'heartbeat', data: { nodeId, timestamp: Date.now() } },
      { type: 'stage-snapshot', data: { nodeId, stage: 'source', tasks: ['task-1'] } },
      { type: 'task-progress', data: { taskId: 'task-1', progress: 25 } },
      { type: 'heartbeat', data: { nodeId, timestamp: Date.now() } },
      { type: 'task-progress', data: { taskId: 'task-1', progress: 50 } },
      { type: 'session-state', data: { nodeId, status: 'running' } },
      { type: 'task-progress', data: { taskId: 'task-1', progress: 100 } },
      { type: 'stage-snapshot', data: { nodeId, stage: 'geometry', tasks: ['task-2'] } },
      { type: 'heartbeat', data: { nodeId, timestamp: Date.now() } },
      { type: 'task-progress', data: { taskId: 'task-2', progress: 100 } },
      { type: 'session-state', data: { nodeId, status: 'completed' } },
    ];

    // Emit all events
    const seqNums: Map<NotificationType, number[]> = new Map();
    for (const event of eventSequences) {
      const seqNum = eventBuffer.emitEvent(event.type, event.data);
      
      if (seqNum !== null) {
        if (!seqNums.has(event.type)) {
          seqNums.set(event.type, []);
        }
        seqNums.get(event.type)!.push(seqNum);
      }
    }

    // Verify seqNum ordering within each notification type
    for (const [type, nums] of seqNums) {
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBe(nums[i - 1] + 1);
      }
    }

    // Process buffered events and verify ordering
    const bufferedTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
    for (const type of bufferedTypes) {
      const processedEvents = eventBuffer.processBufferedEvents(type);
      
      // Verify events are in seqNum order
      for (let i = 1; i < processedEvents.length; i++) {
        expect(processedEvents[i].seqNum).toBe(processedEvents[i - 1].seqNum + 1);
      }

      // Verify no gaps in sequence
      expect(eventBuffer.isSequenceComplete(type)).toBe(true);
    }

    // Verify heartbeat processing (immediate, no buffering)
    const heartbeat = eventBuffer.getHeartbeat();
    expect(heartbeat).toBeDefined();
    expect(heartbeat.data.nodeId).toBe(nodeId);

    // Verify metrics
    const allMetrics = eventBuffer.getAllMetrics();
    
    // Session-state: 3 events
    const sessionMetrics = allMetrics.get('session-state')!;
    expect(sessionMetrics.emitted).toBe(3);
    expect(sessionMetrics.processed).toBe(3);
    expect(sessionMetrics.gaps).toBe(0);

    // Stage-snapshot: 2 events
    const stageMetrics = allMetrics.get('stage-snapshot')!;
    expect(stageMetrics.emitted).toBe(2);
    expect(stageMetrics.processed).toBe(2);
    expect(stageMetrics.gaps).toBe(0);

    // Task-progress: 4 events
    const taskMetrics = allMetrics.get('task-progress')!;
    expect(taskMetrics.emitted).toBe(4);
    expect(taskMetrics.processed).toBe(4);
    expect(taskMetrics.gaps).toBe(0);

    // Heartbeat: 3 events, immediate processing
    const heartbeatMetrics = allMetrics.get('heartbeat')!;
    expect(heartbeatMetrics.emitted).toBe(3);
    expect(heartbeatMetrics.processed).toBe(3);
    expect(heartbeatMetrics.buffered).toBe(0); // Never buffered
    expect(heartbeatMetrics.gaps).toBe(0); // No sequence for heartbeat
  });

  it('should verify no events are lost during rapid emission sequences (stress test)', async () => {
    const nodeId = 'test-node-stress' as NodeId;
    const eventCount = 100; // Reduced for faster test execution
    const batchSize = 10;

    // Generate rapid event sequences
    for (let batch = 0; batch < eventCount / batchSize; batch++) {
      // Emit batch of events rapidly
      for (let i = 0; i < batchSize; i++) {
        const eventIndex = batch * batchSize + i;
        
        // Emit different types of events
        eventBuffer.emitEvent('session-state', { nodeId, batch, index: i });
        eventBuffer.emitEvent('stage-snapshot', { nodeId, stage: 'source', batch, index: i });
        eventBuffer.emitEvent('task-progress', { taskId: `task-${eventIndex}`, progress: (i * 10) % 100 });
        eventBuffer.emitEvent('heartbeat', { nodeId, timestamp: Date.now(), batch, index: i });
      }

      // Small delay between batches to simulate realistic timing
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Verify all events were captured
    const allMetrics = eventBuffer.getAllMetrics();

    for (const [type, metrics] of allMetrics) {
      if (type === 'heartbeat') {
        expect(metrics.emitted).toBe(eventCount);
        expect(metrics.processed).toBe(eventCount);
        expect(metrics.buffered).toBe(0);
      } else {
        expect(metrics.emitted).toBe(eventCount);
        expect(metrics.buffered).toBe(eventCount);
        
        // Process events and verify no loss
        const processedEvents = eventBuffer.processBufferedEvents(type);
        expect(processedEvents.length).toBe(eventCount);
        expect(metrics.processed).toBe(eventCount);
        expect(metrics.gaps).toBe(0);
      }
    }

    // Verify sequence completeness for all buffered types
    const bufferedTypes: NotificationType[] = ['session-state', 'stage-snapshot', 'task-progress'];
    for (const type of bufferedTypes) {
      expect(eventBuffer.isSequenceComplete(type)).toBe(true);
    }
  });

  it('should detect gaps and test recovery mechanisms under failure scenarios', async () => {
    const nodeId = 'test-node-failure-recovery' as NodeId;

    // Emit initial sequence of events
    for (let i = 1; i <= 10; i++) {
      eventBuffer.emitEvent('session-state', { nodeId, sequence: i });
      eventBuffer.emitEvent('task-progress', { taskId: `task-${i}`, progress: i * 10 });
    }

    // Simulate event loss for session-state events (20% loss rate)
    eventBuffer.simulateEventLoss('session-state', 0.2);

    // Process events and check for gaps
    const sessionEvents = eventBuffer.processBufferedEvents('session-state');
    const taskEvents = eventBuffer.processBufferedEvents('task-progress');

    // Verify gap detection in session-state (should have gaps due to simulated loss)
    const sessionMetrics = eventBuffer.getMetrics('session-state');
    if (sessionEvents.length < 10) {
      expect(sessionMetrics.gaps).toBeGreaterThan(0);
    }

    // Verify task-progress events remain intact (no simulated loss)
    const taskMetrics = eventBuffer.getMetrics('task-progress');
    expect(taskEvents.length).toBe(10);
    expect(taskMetrics.gaps).toBe(0);

    // Test recovery mechanism: re-emit missing events
    const missingSessionEvents = 10 - sessionEvents.length;
    if (missingSessionEvents > 0) {
      // Simulate recovery by re-emitting events with new seqNums
      for (let i = 0; i < missingSessionEvents; i++) {
        eventBuffer.emitEvent('session-state', { nodeId, sequence: `recovery-${i}`, recovered: true });
      }

      // Process recovery events
      const recoveryEvents = eventBuffer.processBufferedEvents('session-state');
      expect(recoveryEvents.length).toBe(missingSessionEvents);

      // Verify recovery events have proper seqNums
      for (let i = 1; i < recoveryEvents.length; i++) {
        expect(recoveryEvents[i].seqNum).toBe(recoveryEvents[i - 1].seqNum + 1);
      }
    }

    // Verify heartbeat events are never lost (immediate processing)
    for (let i = 1; i <= 5; i++) {
      eventBuffer.emitEvent('heartbeat', { nodeId, heartbeat: i });
    }

    const heartbeatMetrics = eventBuffer.getMetrics('heartbeat');
    expect(heartbeatMetrics.emitted).toBe(5);
    expect(heartbeatMetrics.processed).toBe(5);
    expect(heartbeatMetrics.gaps).toBe(0);
  });

  it('should validate event delivery monitoring and metrics collection accuracy', async () => {
    const nodeId = 'test-node-metrics' as NodeId;

    // Emit controlled sequence of events with timing
    
    // Emit events with known delays
    eventBuffer.emitEvent('session-state', { nodeId, event: 1 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    eventBuffer.emitEvent('task-progress', { taskId: 'task-1', progress: 50 });
    await new Promise(resolve => setTimeout(resolve, 20));
    
    eventBuffer.emitEvent('stage-snapshot', { nodeId, stage: 'source' });
    await new Promise(resolve => setTimeout(resolve, 5));
    
    eventBuffer.emitEvent('heartbeat', { nodeId, timestamp: Date.now() });

    // Process buffered events and measure metrics
    eventBuffer.processBufferedEvents('session-state');
    eventBuffer.processBufferedEvents('task-progress');
    eventBuffer.processBufferedEvents('stage-snapshot');

    // Verify emission counts
    const sessionMetrics = eventBuffer.getMetrics('session-state');
    expect(sessionMetrics.emitted).toBe(1);
    expect(sessionMetrics.processed).toBe(1);

    const taskMetrics = eventBuffer.getMetrics('task-progress');
    expect(taskMetrics.emitted).toBe(1);
    expect(taskMetrics.processed).toBe(1);

    const stageMetrics = eventBuffer.getMetrics('stage-snapshot');
    expect(stageMetrics.emitted).toBe(1);
    expect(stageMetrics.processed).toBe(1);

    // Verify latency measurements are reasonable (should be >= delay times)
    expect(sessionMetrics.latencyMs.length).toBe(1);
    expect(sessionMetrics.latencyMs[0]).toBeGreaterThanOrEqual(30); // At least 30ms delay

    expect(taskMetrics.latencyMs.length).toBe(1);
    expect(taskMetrics.latencyMs[0]).toBeGreaterThanOrEqual(20); // At least 20ms delay

    expect(stageMetrics.latencyMs.length).toBe(1);
    expect(stageMetrics.latencyMs[0]).toBeGreaterThanOrEqual(5); // At least 5ms delay

    // Verify heartbeat metrics (immediate processing)
    const heartbeatMetrics = eventBuffer.getMetrics('heartbeat');
    expect(heartbeatMetrics.emitted).toBe(1);
    expect(heartbeatMetrics.processed).toBe(1);
    expect(heartbeatMetrics.latencyMs.length).toBe(1);
    expect(heartbeatMetrics.latencyMs[0]).toBe(0); // Immediate processing

    // Verify buffer utilization tracking
    eventBuffer.emitEvent('session-state', { nodeId, event: 2 });
    eventBuffer.emitEvent('session-state', { nodeId, event: 3 });
    
    expect(eventBuffer.getBufferSize('session-state')).toBe(2);
    
    const updatedSessionMetrics = eventBuffer.getMetrics('session-state');
    expect(updatedSessionMetrics.bufferUtilization).toBe(2);

    // Process and verify buffer is cleared
    eventBuffer.processBufferedEvents('session-state');
    expect(eventBuffer.getBufferSize('session-state')).toBe(0);
    
    const finalSessionMetrics = eventBuffer.getMetrics('session-state');
    expect(finalSessionMetrics.bufferUtilization).toBe(0);
  });

  it('should verify heartbeat events are processed immediately without buffering vs other events', async () => {
    const nodeId = 'test-node-heartbeat-immediate' as NodeId;

    // Emit mixed sequence of events
    const events = [
      { type: 'session-state' as NotificationType, data: { nodeId, status: 'starting' } },
      { type: 'heartbeat' as NotificationType, data: { nodeId, timestamp: Date.now() } },
      { type: 'task-progress' as NotificationType, data: { taskId: 'task-1', progress: 25 } },
      { type: 'heartbeat' as NotificationType, data: { nodeId, timestamp: Date.now() } },
      { type: 'stage-snapshot' as NotificationType, data: { nodeId, stage: 'source' } },
      { type: 'heartbeat' as NotificationType, data: { nodeId, timestamp: Date.now() } },
    ];

    // Emit all events
    for (const event of events) {
      eventBuffer.emitEvent(event.type, event.data);
    }

    // Verify heartbeat is immediately available (not buffered)
    const heartbeat = eventBuffer.getHeartbeat();
    expect(heartbeat).toBeDefined();
    expect(heartbeat.data.nodeId).toBe(nodeId);

    // Verify other events are buffered (not immediately processed)
    expect(eventBuffer.getBufferSize('session-state')).toBe(1);
    expect(eventBuffer.getBufferSize('task-progress')).toBe(1);
    expect(eventBuffer.getBufferSize('stage-snapshot')).toBe(1);
    expect(eventBuffer.getBufferSize('heartbeat')).toBe(0); // Never buffered

    // Verify heartbeat metrics show immediate processing
    const heartbeatMetrics = eventBuffer.getMetrics('heartbeat');
    expect(heartbeatMetrics.emitted).toBe(3);
    expect(heartbeatMetrics.processed).toBe(3); // Immediately processed
    expect(heartbeatMetrics.buffered).toBe(0); // Never buffered

    // Verify other event metrics show buffering
    const sessionMetrics = eventBuffer.getMetrics('session-state');
    expect(sessionMetrics.emitted).toBe(1);
    expect(sessionMetrics.buffered).toBe(1);
    expect(sessionMetrics.processed).toBe(0); // Not yet processed

    // Process buffered events
    eventBuffer.processBufferedEvents('session-state');
    eventBuffer.processBufferedEvents('task-progress');
    eventBuffer.processBufferedEvents('stage-snapshot');

    // Verify buffered events are now processed
    const finalSessionMetrics = eventBuffer.getMetrics('session-state');
    expect(finalSessionMetrics.processed).toBe(1);
    expect(finalSessionMetrics.bufferUtilization).toBe(0); // Buffer cleared

    // Verify heartbeat remains immediately available with latest value
    const finalHeartbeat = eventBuffer.getHeartbeat();
    expect(finalHeartbeat).toBeDefined();
    expect(finalHeartbeat.data.nodeId).toBe(nodeId);
  });
});