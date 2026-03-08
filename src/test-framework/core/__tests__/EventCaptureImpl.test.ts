// EventCaptureImpl unit tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventCaptureImpl } from '../EventCaptureImpl.js';
import type { 
  CapturedEvent, 
  EventPattern, 
  TimingConstraints,
  NotificationType 
} from '../../types/EventTypes.js';

describe('EventCaptureImpl', () => {
  let eventCapture: EventCaptureImpl;

  beforeEach(() => {
    eventCapture = new EventCaptureImpl();
  });

  describe('captureEventStream', () => {
    it('should create a new event stream capture', () => {
      const nodeId = 'test-node-1';
      const eventTypes: NotificationType[] = ['session-state', 'task-progress'];

      const capture = eventCapture.captureEventStream(nodeId, eventTypes);

      expect(capture.nodeId).toBe(nodeId);
      expect(capture.eventTypes).toEqual(eventTypes);
      expect(capture.isActive).toBe(true);
      expect(capture.captureId).toMatch(/^capture_\d+_\d+$/);
      expect(typeof capture.startTime).toBe('number');
    });

    it('should throw error for empty nodeId', () => {
      expect(() => {
        eventCapture.captureEventStream('', ['session-state']);
      }).toThrow('Contract violation: nodeId must be a non-empty string');
    });

    it('should throw error for empty eventTypes', () => {
      expect(() => {
        eventCapture.captureEventStream('test-node', []);
      }).toThrow('Contract violation: eventTypes must be a non-empty array');
    });

    it('should throw error for invalid eventType', () => {
      expect(() => {
        eventCapture.captureEventStream('test-node', ['invalid-type' as NotificationType]);
      }).toThrow("Contract violation: invalid eventType 'invalid-type'");
    });
  });

  describe('stopCapture', () => {
    it('should stop active capture and return captured events', () => {
      const nodeId = 'test-node-1';
      const eventTypes: NotificationType[] = ['session-state'];
      
      const capture = eventCapture.captureEventStream(nodeId, eventTypes);
      const result = eventCapture.stopCapture(capture);

      expect(result.captureId).toBe(capture.captureId);
      expect(result.events).toEqual([]);
      expect(result.captureStartTime).toBe(capture.startTime);
      expect(result.totalEvents).toBe(0);
      expect(typeof result.captureEndTime).toBe('number');
      expect(result.captureEndTime).toBeGreaterThanOrEqual(result.captureStartTime);
    });

    it('should throw error for invalid capture object', () => {
      expect(() => {
        eventCapture.stopCapture(null as any);
      }).toThrow('Contract violation: capture must be a valid EventStreamCapture object');
    });

    it('should throw error for non-existent capture', () => {
      const fakeCaptureId = 'non-existent-capture';
      expect(() => {
        eventCapture.stopCapture({
          captureId: fakeCaptureId,
          nodeId: 'test',
          eventTypes: ['session-state'],
          startTime: Date.now(),
          isActive: true
        });
      }).toThrow(`Contract violation: capture with ID '${fakeCaptureId}' not found`);
    });

    it('should throw error when stopping already stopped capture', () => {
      const capture = eventCapture.captureEventStream('test-node', ['session-state']);
      eventCapture.stopCapture(capture);
      
      expect(() => {
        eventCapture.stopCapture(capture);
      }).toThrow(`Contract violation: capture with ID '${capture.captureId}' not found`);
    });
  });

  describe('validateEventSequence', () => {
    it('should validate correct event sequence', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: { status: 'running' }
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: { progress: 50 }
        }
      ];

      const pattern: EventPattern = {
        sequence: [
          { eventType: 'session-state' },
          { eventType: 'task-progress' }
        ]
      };

      const result = eventCapture.validateEventSequence(events, pattern);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata?.matchedEvents).toBe(2);
    });

    it('should detect sequence mismatch', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: { progress: 50 }
        }
      ];

      const pattern: EventPattern = {
        sequence: [
          { eventType: 'session-state' }
        ]
      };

      const result = eventCapture.validateEventSequence(events, pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SEQUENCE_MISMATCH');
    });

    it('should handle payload matcher validation', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: { status: 'paused' }
        }
      ];

      const pattern: EventPattern = {
        sequence: [
          { 
            eventType: 'session-state',
            payloadMatcher: (payload: any) => payload.status === 'running'
          }
        ]
      };

      const result = eventCapture.validateEventSequence(events, pattern);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PAYLOAD_MISMATCH');
    });

    it('should throw error for null events', () => {
      const pattern: EventPattern = {
        sequence: [{ eventType: 'session-state' }]
      };

      expect(() => {
        eventCapture.validateEventSequence(null as any, pattern);
      }).toThrow('Contract violation: events must be provided');
    });

    it('should throw error for invalid pattern', () => {
      const events: CapturedEvent[] = [];

      expect(() => {
        eventCapture.validateEventSequence(events, null as any);
      }).toThrow('Contract violation: expectedPattern must have a non-empty sequence');
    });
  });

  describe('validateEventTiming', () => {
    it('should validate events within timing constraints', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {},
          deliveryLatency: 50
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {},
          deliveryLatency: 75
        }
      ];

      const constraints: TimingConstraints = {
        maxDeliveryLatencyMs: 100,
        maxEventIntervalMs: 1500,
        minEventIntervalMs: 500
      };

      const result = eventCapture.validateEventTiming(events, constraints);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect latency violations', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {},
          deliveryLatency: 150
        }
      ];

      const constraints: TimingConstraints = {
        maxDeliveryLatencyMs: 100
      };

      const result = eventCapture.validateEventTiming(events, constraints);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('LATENCY_EXCEEDED');
    });

    it('should detect invalid latency values', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {},
          deliveryLatency: -10
        }
      ];

      const constraints: TimingConstraints = {
        maxDeliveryLatencyMs: 100
      };

      const result = eventCapture.validateEventTiming(events, constraints);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_LATENCY');
    });

    it('should throw error for invalid constraints', () => {
      const events: CapturedEvent[] = [];

      expect(() => {
        eventCapture.validateEventTiming(events, {
          maxDeliveryLatencyMs: -1
        });
      }).toThrow('Contract violation: maxDeliveryLatencyMs must be a finite non-negative number');
    });
  });

  describe('verifySequenceNumbers', () => {
    it('should validate correct sequence numbers', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = eventCapture.verifySequenceNumbers(events);

      expect(result.isValid).toBe(true);
      expect(result.gaps).toHaveLength(0);
      expect(result.duplicates).toHaveLength(0);
      expect(result.outOfOrder).toHaveLength(0);
    });

    it('should detect sequence gaps', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 3,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = eventCapture.verifySequenceNumbers(events);

      expect(result.isValid).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].expectedSequence).toBe(2);
      expect(result.gaps[0].actualSequence).toBe(3);
      expect(result.gaps[0].gapSize).toBe(1);
    });

    it('should detect duplicate sequence numbers', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = eventCapture.verifySequenceNumbers(events);

      expect(result.isValid).toBe(false);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].sequenceNumber).toBe(1);
      expect(result.duplicates[0].occurrences).toBe(2);
    });
  });

  describe('detectEventLoss', () => {
    it('should detect no event loss when counts match', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 1,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = eventCapture.detectEventLoss(events, 2);

      expect(result.totalExpected).toBe(2);
      expect(result.totalReceived).toBe(2);
      expect(result.lossRate).toBe(0);
      expect(result.missingEvents).toHaveLength(0);
    });

    it('should detect event loss when received count is less than expected', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        }
      ];

      const result = eventCapture.detectEventLoss(events, 3);

      expect(result.totalExpected).toBe(3);
      expect(result.totalReceived).toBe(1);
      expect(result.lossRate).toBeCloseTo(0.667, 3);
    });

    it('should throw error for invalid expected count', () => {
      const events: CapturedEvent[] = [];

      expect(() => {
        eventCapture.detectEventLoss(events, -1);
      }).toThrow('Contract violation: expectedCount must be a finite non-negative number');
    });
  });

  describe('filterEventsByType', () => {
    it('should filter events by type correctly', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 3,
          timestamp: 3000,
          payload: {}
        }
      ];

      const filtered = eventCapture.filterEventsByType(events, 'session-state');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.eventType === 'session-state')).toBe(true);
    });

    it('should throw error for null events', () => {
      expect(() => {
        eventCapture.filterEventsByType(null as any, 'session-state');
      }).toThrow('Contract violation: events must be provided');
    });
  });

  describe('analyzeEventLatency', () => {
    it('should analyze latency correctly', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {},
          deliveryLatency: 10
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {},
          deliveryLatency: 20
        },
        {
          nodeId: 'test-node',
          eventType: 'heartbeat',
          sequenceNumber: 3,
          timestamp: 3000,
          payload: {},
          deliveryLatency: 30
        }
      ];

      const analysis = eventCapture.analyzeEventLatency(events);

      expect(analysis.averageLatency).toBe(20);
      expect(analysis.medianLatency).toBe(20);
      expect(analysis.minLatency).toBe(10);
      expect(analysis.maxLatency).toBe(30);
      expect(analysis.outliers).toHaveLength(0);
    });

    it('should handle empty events array', () => {
      const analysis = eventCapture.analyzeEventLatency([]);

      expect(analysis.averageLatency).toBe(0);
      expect(analysis.medianLatency).toBe(0);
      expect(analysis.minLatency).toBe(0);
      expect(analysis.maxLatency).toBe(0);
      expect(analysis.outliers).toHaveLength(0);
    });

    it('should handle events without latency data', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
          // No deliveryLatency
        }
      ];

      const analysis = eventCapture.analyzeEventLatency(events);

      expect(analysis.averageLatency).toBe(0);
      expect(analysis.medianLatency).toBe(0);
      expect(analysis.minLatency).toBe(0);
      expect(analysis.maxLatency).toBe(0);
    });
  });

  describe('listActiveCaptures', () => {
    it('should list active captures', () => {
      const capture1 = eventCapture.captureEventStream('node1', ['session-state']);
      const capture2 = eventCapture.captureEventStream('node2', ['task-progress']);

      const activeCaptures = eventCapture.listActiveCaptures();

      expect(activeCaptures).toHaveLength(2);
      expect(activeCaptures.find(c => c.captureId === capture1.captureId)).toBeDefined();
      expect(activeCaptures.find(c => c.captureId === capture2.captureId)).toBeDefined();
    });

    it('should return empty array when no active captures', () => {
      const activeCaptures = eventCapture.listActiveCaptures();
      expect(activeCaptures).toHaveLength(0);
    });
  });

  describe('simulateEventLoss', () => {
    it('should return all events when loss rate is 0', () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = eventCapture.simulateEventLoss(events, 0);

      expect(result).toHaveLength(2);
      expect(result).toEqual(events);
    });

    it('should return empty array when loss rate is 1', () => {
      // Mock Math.random to always return 0.5
      const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        }
      ];

      const result = eventCapture.simulateEventLoss(events, 1);

      expect(result).toHaveLength(0);

      mockRandom.mockRestore();
    });

    it('should throw error for invalid loss rate', () => {
      const events: CapturedEvent[] = [];

      expect(() => {
        eventCapture.simulateEventLoss(events, -0.1);
      }).toThrow('Contract violation: lossRate must be a finite number between 0 and 1');

      expect(() => {
        eventCapture.simulateEventLoss(events, 1.1);
      }).toThrow('Contract violation: lossRate must be a finite number between 0 and 1');
    });
  });

  describe('pauseCapture and resumeCapture', () => {
    it('should pause and resume capture successfully', async () => {
      const capture = eventCapture.captureEventStream('test-node', ['session-state']);

      await expect(eventCapture.pauseCapture(capture.captureId)).resolves.toBeUndefined();
      await expect(eventCapture.resumeCapture(capture.captureId)).resolves.toBeUndefined();
    });

    it('should throw error for invalid capture ID', async () => {
      await expect(eventCapture.pauseCapture('invalid-id')).rejects.toThrow(
        "Contract violation: capture with ID 'invalid-id' not found"
      );

      await expect(eventCapture.resumeCapture('invalid-id')).rejects.toThrow(
        "Contract violation: capture with ID 'invalid-id' not found"
      );
    });

    it('should throw error for empty capture ID', async () => {
      await expect(eventCapture.pauseCapture('')).rejects.toThrow(
        'Contract violation: captureId must be a non-empty string'
      );

      await expect(eventCapture.resumeCapture('')).rejects.toThrow(
        'Contract violation: captureId must be a non-empty string'
      );
    });
  });

  describe('replayEvents', () => {
    it('should replay events successfully', async () => {
      const events: CapturedEvent[] = [
        {
          nodeId: 'test-node',
          eventType: 'session-state',
          sequenceNumber: 1,
          timestamp: 1000,
          payload: {}
        },
        {
          nodeId: 'test-node',
          eventType: 'task-progress',
          sequenceNumber: 2,
          timestamp: 2000,
          payload: {}
        }
      ];

      const result = await eventCapture.replayEvents(events, 'target-node');

      expect(result.success).toBe(true);
      expect(result.replayedEvents).toBe(2);
      expect(result.failedEvents).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should throw error for invalid parameters', async () => {
      await expect(eventCapture.replayEvents(null as any, 'target-node')).rejects.toThrow(
        'Contract violation: events must be provided'
      );

      await expect(eventCapture.replayEvents([], '')).rejects.toThrow(
        'Contract violation: targetNodeId must be a non-empty string'
      );
    });
  });
});