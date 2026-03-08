// EventCapture - Event stream capture and verification layer

import type {
  NotificationType,
  CapturedEvent,
  EventStreamCapture,
  CapturedEvents,
  EventPattern,
  TimingConstraints,
  SequenceValidationResult,
  EventLossReport
} from '../types/EventTypes.js';
import type { ValidationResult } from '../types/ValidationTypes.js';
import type { NodeId } from '../types/SessionTypes.js';

/**
 * EventCapture - Event stream monitoring and validation
 * 
 * Captures and validates event streams from UnconditionalEventStreamer,
 * providing comprehensive verification of event delivery, ordering,
 * and integrity across the Worker-UI communication layer.
 */
export interface EventCapture {
  // Event stream monitoring
  captureEventStream(nodeId: NodeId, eventTypes: NotificationType[]): EventStreamCapture;
  stopCapture(capture: EventStreamCapture): CapturedEvents;
  
  // Event validation
  validateEventSequence(events: CapturedEvent[], expectedPattern: EventPattern): ValidationResult;
  validateEventTiming(events: CapturedEvent[], timingConstraints: TimingConstraints): ValidationResult;
  
  // Sequence number verification
  verifySequenceNumbers(events: CapturedEvent[]): SequenceValidationResult;
  detectEventLoss(events: CapturedEvent[], expectedCount: number): EventLossReport;
  
  // Event filtering and analysis
  filterEventsByType(events: CapturedEvent[], eventType: NotificationType): CapturedEvent[];
  analyzeEventLatency(events: CapturedEvent[]): LatencyAnalysis;
  
  // Capture management
  listActiveCaptures(): EventStreamCapture[];
  pauseCapture(captureId: string): Promise<void>;
  resumeCapture(captureId: string): Promise<void>;
  
  // Event replay and simulation
  replayEvents(events: CapturedEvent[], targetNodeId: NodeId): Promise<ReplayResult>;
  simulateEventLoss(events: CapturedEvent[], lossRate: number): CapturedEvent[];
}

export interface LatencyAnalysis {
  averageLatency: number;
  medianLatency: number;
  maxLatency: number;
  minLatency: number;
  percentiles: Record<number, number>; // 95th, 99th, etc.
  outliers: CapturedEvent[];
}

export interface ReplayResult {
  success: boolean;
  replayedEvents: number;
  failedEvents: number;
  duration: number;
  errors: Error[];
}