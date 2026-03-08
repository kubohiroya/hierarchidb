// Event-related type definitions

export type NotificationType = 
  | 'session-state'
  | 'task-progress'
  | 'stage-snapshot'
  | 'heartbeat'
  | 'error';

export interface CapturedEvent {
  nodeId: NodeId;
  eventType: NotificationType;
  sequenceNumber: number;
  timestamp: number;
  payload: unknown;
  deliveryLatency?: number;
}

export interface EventStreamCapture {
  captureId: string;
  nodeId: NodeId;
  eventTypes: NotificationType[];
  startTime: number;
  isActive: boolean;
}

export interface CapturedEvents {
  captureId: string;
  events: CapturedEvent[];
  captureStartTime: number;
  captureEndTime: number;
  totalEvents: number;
}

export interface EventPattern {
  sequence: EventPatternStep[];
  allowIntermediateEvents?: boolean;
  timeoutMs?: number;
}

export interface EventPatternStep {
  eventType: NotificationType;
  payloadMatcher?: (payload: unknown) => boolean;
  sequenceConstraint?: 'strict' | 'monotonic' | 'any';
}

export interface TimingConstraints {
  maxDeliveryLatencyMs: number;
  maxEventIntervalMs?: number;
  minEventIntervalMs?: number;
}

export interface SequenceValidationResult {
  isValid: boolean;
  gaps: SequenceGap[];
  duplicates: SequenceDuplicate[];
  outOfOrder: OutOfOrderEvent[];
}

export interface SequenceGap {
  eventType: NotificationType;
  expectedSequence: number;
  actualSequence: number;
  gapSize: number;
}

export interface SequenceDuplicate {
  eventType: NotificationType;
  sequenceNumber: number;
  occurrences: number;
}

export interface OutOfOrderEvent {
  eventType: NotificationType;
  sequenceNumber: number;
  expectedPosition: number;
  actualPosition: number;
}

export interface EventLossReport {
  totalExpected: number;
  totalReceived: number;
  lossRate: number;
  missingEvents: MissingEvent[];
}

export interface MissingEvent {
  eventType: NotificationType;
  expectedSequence: number;
  lastSeenSequence: number;
}

export interface ProgressEvent {
  taskId: TaskId;
  progress: number;
  stage: BuildStage;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

import type { NodeId, TaskId, BuildStage } from './SessionTypes.js';