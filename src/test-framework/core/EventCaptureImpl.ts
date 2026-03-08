// EventCaptureImpl - Event stream capture and verification implementation

import type {
  NotificationType,
  CapturedEvent,
  EventStreamCapture,
  CapturedEvents,
  EventPattern,
  TimingConstraints,
  SequenceValidationResult,
  EventLossReport,
  SequenceGap,
  SequenceDuplicate,
  OutOfOrderEvent,
  MissingEvent
} from '../types/EventTypes.js';
import type { ValidationResult } from '../types/ValidationTypes.js';
import type { NodeId } from '../types/SessionTypes.js';
import type { EventCapture, LatencyAnalysis, ReplayResult } from './EventCapture.js';

/**
 * EventCaptureImpl - Concrete implementation of event stream monitoring and validation
 * 
 * Provides comprehensive event capture, validation, and analysis capabilities
 * for UnconditionalEventStreamer integration testing.
 */
export class EventCaptureImpl implements EventCapture {
  private activeCaptures = new Map<string, EventStreamCaptureState>();
  private captureCounter = 0;

  // Event stream monitoring
  captureEventStream(nodeId: NodeId, eventTypes: NotificationType[]): EventStreamCapture {
    if (!nodeId || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be a non-empty string');
    }
    
    if (!eventTypes || eventTypes.length === 0) {
      throw new Error('Contract violation: eventTypes must be a non-empty array');
    }

    // Validate event types
    const validEventTypes: NotificationType[] = [
      'session-state', 'task-progress', 'stage-snapshot', 'heartbeat', 'error'
    ];
    
    for (const eventType of eventTypes) {
      if (!validEventTypes.includes(eventType)) {
        throw new Error(`Contract violation: invalid eventType '${eventType}'`);
      }
    }

    const captureId = `capture_${++this.captureCounter}_${Date.now()}`;
    const startTime = Date.now();
    
    const capture: EventStreamCapture = {
      captureId,
      nodeId,
      eventTypes,
      startTime,
      isActive: true
    };

    const captureState: EventStreamCaptureState = {
      capture,
      events: [],
      subscribers: new Map()
    };

    this.activeCaptures.set(captureId, captureState);
    
    // Start event monitoring for specified types
    this.startEventMonitoring(captureState);
    
    return capture;
  }

  stopCapture(capture: EventStreamCapture): CapturedEvents {
    if (!capture || !capture.captureId) {
      throw new Error('Contract violation: capture must be a valid EventStreamCapture object');
    }

    const captureState = this.activeCaptures.get(capture.captureId);
    if (!captureState) {
      throw new Error(`Contract violation: capture with ID '${capture.captureId}' not found`);
    }

    if (!captureState.capture.isActive) {
      throw new Error(`Contract violation: capture '${capture.captureId}' is already stopped`);
    }

    // Stop event monitoring
    this.stopEventMonitoring(captureState);
    
    const captureEndTime = Date.now();
    captureState.capture.isActive = false;

    const result: CapturedEvents = {
      captureId: capture.captureId,
      events: [...captureState.events], // Create defensive copy
      captureStartTime: capture.startTime,
      captureEndTime,
      totalEvents: captureState.events.length
    };

    // Clean up capture state
    this.activeCaptures.delete(capture.captureId);
    
    return result;
  }

  // Event validation
  validateEventSequence(events: CapturedEvent[], expectedPattern: EventPattern): ValidationResult {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!expectedPattern || !expectedPattern.sequence || expectedPattern.sequence.length === 0) {
      throw new Error('Contract violation: expectedPattern must have a non-empty sequence');
    }

    const errors: Array<{ code: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = [];
    const warnings: Array<{ code: string; message: string; suggestion?: string }> = [];

    let patternIndex = 0;
    let eventIndex = 0;
    const matchedEvents: CapturedEvent[] = [];

    while (eventIndex < events.length && patternIndex < expectedPattern.sequence.length) {
      const currentEvent = events[eventIndex];
      const expectedStep = expectedPattern.sequence[patternIndex];

      if (currentEvent.eventType === expectedStep.eventType) {
        // Check payload matcher if provided
        if (expectedStep.payloadMatcher && !expectedStep.payloadMatcher(currentEvent.payload)) {
          errors.push({
            code: 'PAYLOAD_MISMATCH',
            message: `Event at index ${eventIndex} has eventType '${currentEvent.eventType}' but payload does not match expected pattern`,
            severity: 'high'
          });
        } else {
          matchedEvents.push(currentEvent);
          patternIndex++;
        }
        eventIndex++;
      } else if (expectedPattern.allowIntermediateEvents) {
        // Skip intermediate events
        eventIndex++;
      } else {
        errors.push({
          code: 'SEQUENCE_MISMATCH',
          message: `Expected eventType '${expectedStep.eventType}' at position ${patternIndex}, but found '${currentEvent.eventType}' at event index ${eventIndex}`,
          severity: 'high'
        });
        break;
      }
    }

    // Check if all pattern steps were matched
    if (patternIndex < expectedPattern.sequence.length && errors.length === 0) {
      errors.push({
        code: 'INCOMPLETE_PATTERN',
        message: `Pattern matching incomplete: matched ${patternIndex}/${expectedPattern.sequence.length} steps`,
        severity: 'high'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        matchedEvents: matchedEvents.length,
        totalEvents: events.length,
        patternSteps: expectedPattern.sequence.length
      }
    };
  }

  validateEventTiming(events: CapturedEvent[], timingConstraints: TimingConstraints): ValidationResult {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!timingConstraints) {
      throw new Error('Contract violation: timingConstraints must be provided');
    }

    if (!Number.isFinite(timingConstraints.maxDeliveryLatencyMs) || timingConstraints.maxDeliveryLatencyMs < 0) {
      throw new Error('Contract violation: maxDeliveryLatencyMs must be a finite non-negative number');
    }

    const errors: Array<{ code: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = [];
    const warnings: Array<{ code: string; message: string; suggestion?: string }> = [];

    // Validate delivery latency
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if (event.deliveryLatency !== undefined) {
        if (!Number.isFinite(event.deliveryLatency) || event.deliveryLatency < 0) {
          errors.push({
            code: 'INVALID_LATENCY',
            message: `Event at index ${i} has invalid deliveryLatency: ${event.deliveryLatency}`,
            severity: 'medium'
          });
          continue;
        }

        if (event.deliveryLatency > timingConstraints.maxDeliveryLatencyMs) {
          errors.push({
            code: 'LATENCY_EXCEEDED',
            message: `Event at index ${i} delivery latency ${event.deliveryLatency}ms exceeds maximum ${timingConstraints.maxDeliveryLatencyMs}ms`,
            severity: 'high'
          });
        }
      }
    }

    // Validate event intervals if constraints provided
    if (timingConstraints.maxEventIntervalMs !== undefined || timingConstraints.minEventIntervalMs !== undefined) {
      for (let i = 1; i < events.length; i++) {
        const prevEvent = events[i - 1];
        const currentEvent = events[i];
        const interval = currentEvent.timestamp - prevEvent.timestamp;

        if (timingConstraints.maxEventIntervalMs !== undefined) {
          if (!Number.isFinite(timingConstraints.maxEventIntervalMs) || timingConstraints.maxEventIntervalMs < 0) {
            throw new Error('Contract violation: maxEventIntervalMs must be a finite non-negative number');
          }
          
          if (interval > timingConstraints.maxEventIntervalMs) {
            warnings.push({
              code: 'INTERVAL_TOO_LONG',
              message: `Interval between events ${i-1} and ${i} is ${interval}ms, exceeds maximum ${timingConstraints.maxEventIntervalMs}ms`,
              suggestion: 'Consider increasing event emission frequency'
            });
          }
        }

        if (timingConstraints.minEventIntervalMs !== undefined) {
          if (!Number.isFinite(timingConstraints.minEventIntervalMs) || timingConstraints.minEventIntervalMs < 0) {
            throw new Error('Contract violation: minEventIntervalMs must be a finite non-negative number');
          }
          
          if (interval < timingConstraints.minEventIntervalMs) {
            warnings.push({
              code: 'INTERVAL_TOO_SHORT',
              message: `Interval between events ${i-1} and ${i} is ${interval}ms, below minimum ${timingConstraints.minEventIntervalMs}ms`,
              suggestion: 'Consider reducing event emission frequency'
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalEvents: events.length,
        eventsWithLatency: events.filter(e => e.deliveryLatency !== undefined).length
      }
    };
  }

  // Sequence number verification
  verifySequenceNumbers(events: CapturedEvent[]): SequenceValidationResult {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }

    const gaps: SequenceGap[] = [];
    const duplicates: SequenceDuplicate[] = [];
    const outOfOrder: OutOfOrderEvent[] = [];

    // Group events by type and nodeId for sequence validation
    const eventGroups = new Map<string, CapturedEvent[]>();
    
    for (const event of events) {
      const groupKey = `${event.nodeId}:${event.eventType}`;
      if (!eventGroups.has(groupKey)) {
        eventGroups.set(groupKey, []);
      }
      eventGroups.get(groupKey)!.push(event);
    }

    // Validate sequence numbers within each group
    for (const [groupKey, groupEvents] of Array.from(eventGroups.entries())) {
      const [nodeId, eventType] = groupKey.split(':') as [string, NotificationType];
      
      // Sort by timestamp to check for out-of-order delivery
      const sortedByTimestamp = [...groupEvents].sort((a, b) => a.timestamp - b.timestamp);
      const sortedBySequence = [...groupEvents].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

      // Check for sequence number gaps and duplicates
      const sequenceNumbers = new Map<number, number>(); // sequence -> count
      let expectedSequence = sortedBySequence[0]?.sequenceNumber ?? 1;

      for (const event of sortedBySequence) {
        const count = sequenceNumbers.get(event.sequenceNumber) ?? 0;
        sequenceNumbers.set(event.sequenceNumber, count + 1);

        if (count > 0) {
          // Duplicate sequence number
          duplicates.push({
            eventType,
            sequenceNumber: event.sequenceNumber,
            occurrences: count + 1
          });
        }

        if (event.sequenceNumber > expectedSequence) {
          // Gap detected
          gaps.push({
            eventType,
            expectedSequence,
            actualSequence: event.sequenceNumber,
            gapSize: event.sequenceNumber - expectedSequence
          });
        }

        expectedSequence = Math.max(expectedSequence, event.sequenceNumber + 1);
      }

      // Check for out-of-order events (sequence numbers not matching timestamp order)
      for (let i = 0; i < sortedByTimestamp.length; i++) {
        const timestampEvent = sortedByTimestamp[i];
        const expectedPosition = sortedBySequence.findIndex(e => 
          e.sequenceNumber === timestampEvent.sequenceNumber && 
          e.timestamp === timestampEvent.timestamp
        );

        if (expectedPosition !== i) {
          outOfOrder.push({
            eventType,
            sequenceNumber: timestampEvent.sequenceNumber,
            expectedPosition,
            actualPosition: i
          });
        }
      }
    }

    return {
      isValid: gaps.length === 0 && duplicates.length === 0 && outOfOrder.length === 0,
      gaps,
      duplicates,
      outOfOrder
    };
  }

  detectEventLoss(events: CapturedEvent[], expectedCount: number): EventLossReport {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!Number.isFinite(expectedCount) || expectedCount < 0) {
      throw new Error('Contract violation: expectedCount must be a finite non-negative number');
    }

    const totalReceived = events.length;
    const lossRate = expectedCount > 0 ? (expectedCount - totalReceived) / expectedCount : 0;
    const missingEvents: MissingEvent[] = [];

    if (totalReceived < expectedCount) {
      // Group events by type to detect missing sequences
      const eventGroups = new Map<NotificationType, CapturedEvent[]>();
      
      for (const event of events) {
        if (!eventGroups.has(event.eventType)) {
          eventGroups.set(event.eventType, []);
        }
        eventGroups.get(event.eventType)!.push(event);
      }

      // Analyze each event type for missing sequences
      for (const [eventType, typeEvents] of Array.from(eventGroups.entries())) {
        const sequences = typeEvents.map(e => e.sequenceNumber).sort((a, b) => a - b);
        
        if (sequences.length > 0) {
          const minSeq = sequences[0];
          const maxSeq = sequences[sequences.length - 1];
          
          for (let seq = minSeq; seq <= maxSeq; seq++) {
            if (!sequences.includes(seq)) {
              const lastSeenIndex = sequences.findIndex(s => s > seq) - 1;
              const lastSeenSequence = lastSeenIndex >= 0 ? sequences[lastSeenIndex] : seq - 1;
              
              missingEvents.push({
                eventType,
                expectedSequence: seq,
                lastSeenSequence
              });
            }
          }
        }
      }
    }

    return {
      totalExpected: expectedCount,
      totalReceived,
      lossRate: Math.max(0, lossRate), // Ensure non-negative
      missingEvents
    };
  }

  // Event filtering and analysis
  filterEventsByType(events: CapturedEvent[], eventType: NotificationType): CapturedEvent[] {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!eventType) {
      throw new Error('Contract violation: eventType must be provided');
    }

    return events.filter(event => event.eventType === eventType);
  }

  analyzeEventLatency(events: CapturedEvent[]): LatencyAnalysis {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }

    const eventsWithLatency = events.filter(e => 
      e.deliveryLatency !== undefined && 
      Number.isFinite(e.deliveryLatency) && 
      e.deliveryLatency >= 0
    );

    if (eventsWithLatency.length === 0) {
      return {
        averageLatency: 0,
        medianLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        percentiles: {},
        outliers: []
      };
    }

    const latencies = eventsWithLatency.map(e => e.deliveryLatency!).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const averageLatency = sum / latencies.length;
    const medianLatency = latencies[Math.floor(latencies.length / 2)];
    const maxLatency = latencies[latencies.length - 1];
    const minLatency = latencies[0];

    // Calculate percentiles
    const percentiles: Record<number, number> = {};
    [50, 75, 90, 95, 99].forEach(p => {
      const index = Math.floor((p / 100) * latencies.length);
      percentiles[p] = latencies[Math.min(index, latencies.length - 1)];
    });

    // Identify outliers (values beyond 1.5 * IQR from Q1/Q3)
    const q1 = percentiles[25] ?? latencies[Math.floor(0.25 * latencies.length)];
    const q3 = percentiles[75];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = eventsWithLatency.filter(e => 
      e.deliveryLatency! < lowerBound || e.deliveryLatency! > upperBound
    );

    return {
      averageLatency,
      medianLatency,
      maxLatency,
      minLatency,
      percentiles,
      outliers
    };
  }

  // Capture management
  listActiveCaptures(): EventStreamCapture[] {
    return Array.from(this.activeCaptures.values())
      .map(state => ({ ...state.capture })); // Return defensive copies
  }

  async pauseCapture(captureId: string): Promise<void> {
    if (!captureId || captureId.trim() === '') {
      throw new Error('Contract violation: captureId must be a non-empty string');
    }

    const captureState = this.activeCaptures.get(captureId);
    if (!captureState) {
      throw new Error(`Contract violation: capture with ID '${captureId}' not found`);
    }

    if (!captureState.capture.isActive) {
      throw new Error(`Contract violation: capture '${captureId}' is not active`);
    }

    // Pause event monitoring
    this.pauseEventMonitoring(captureState);
  }

  async resumeCapture(captureId: string): Promise<void> {
    if (!captureId || captureId.trim() === '') {
      throw new Error('Contract violation: captureId must be a non-empty string');
    }

    const captureState = this.activeCaptures.get(captureId);
    if (!captureState) {
      throw new Error(`Contract violation: capture with ID '${captureId}' not found`);
    }

    if (!captureState.capture.isActive) {
      throw new Error(`Contract violation: capture '${captureId}' is not active`);
    }

    // Resume event monitoring
    this.resumeEventMonitoring(captureState);
  }

  // Event replay and simulation
  async replayEvents(events: CapturedEvent[], targetNodeId: NodeId): Promise<ReplayResult> {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!targetNodeId || targetNodeId.trim() === '') {
      throw new Error('Contract violation: targetNodeId must be a non-empty string');
    }

    const startTime = Date.now();
    let replayedEvents = 0;
    let failedEvents = 0;
    const errors: Error[] = [];

    // Sort events by timestamp for proper replay order
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sortedEvents) {
      try {
        // Simulate event replay (in real implementation, this would emit to UnconditionalEventStreamer)
        await this.simulateEventEmission(event, targetNodeId);
        replayedEvents++;
      } catch (error) {
        failedEvents++;
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: failedEvents === 0,
      replayedEvents,
      failedEvents,
      duration,
      errors
    };
  }

  simulateEventLoss(events: CapturedEvent[], lossRate: number): CapturedEvent[] {
    if (!events) {
      throw new Error('Contract violation: events must be provided');
    }
    
    if (!Number.isFinite(lossRate) || lossRate < 0 || lossRate > 1) {
      throw new Error('Contract violation: lossRate must be a finite number between 0 and 1');
    }

    if (lossRate === 0) {
      return [...events]; // Return defensive copy
    }

    const result: CapturedEvent[] = [];
    
    for (const event of events) {
      if (Math.random() > lossRate) {
        result.push(event);
      }
    }

    return result;
  }

  // Private helper methods
  private startEventMonitoring(captureState: EventStreamCaptureState): void {
    // In real implementation, this would subscribe to UnconditionalEventStreamer
    // For now, we'll set up a mock monitoring system
    captureState.isMonitoring = true;
  }

  private stopEventMonitoring(captureState: EventStreamCaptureState): void {
    // In real implementation, this would unsubscribe from UnconditionalEventStreamer
    captureState.isMonitoring = false;
    captureState.subscribers.clear();
  }

  private pauseEventMonitoring(captureState: EventStreamCaptureState): void {
    captureState.isMonitoring = false;
  }

  private resumeEventMonitoring(captureState: EventStreamCaptureState): void {
    captureState.isMonitoring = true;
  }

  private async simulateEventEmission(event: CapturedEvent, targetNodeId: NodeId): Promise<void> {
    // In real implementation, this would emit the event to UnconditionalEventStreamer
    // For now, we'll simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

// Internal state management interfaces
interface EventStreamCaptureState {
  capture: EventStreamCapture;
  events: CapturedEvent[];
  subscribers: Map<string, (event: CapturedEvent) => void>;
  isMonitoring?: boolean;
}