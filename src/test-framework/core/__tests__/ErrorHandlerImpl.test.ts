// ErrorHandlerImpl unit tests

import { ErrorHandlerImpl } from '../ErrorHandlerImpl.js';
import { MockUtils } from '../../utils/MockUtils.js';
import type {
  ErrorCategory,
  ErrorDetectionResult,
  ErrorClassificationResult
} from '../ErrorHandler.js';
import type {
  CapturedEvent
} from '../../types/EventTypes.js';
import type {
  NodeId,
  SessionId
} from '../../types/SessionTypes.js';

describe('ErrorHandlerImpl', () => {
  let errorHandler: ErrorHandlerImpl;
  const mockNodeId: NodeId = 'test-node-123';
  const mockSessionId: SessionId = 'test-session-456';

  beforeEach(() => {
    errorHandler = new ErrorHandlerImpl();
  });

  describe('Error Detection', () => {
    it('should detect worker crash errors', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'worker-crash',
          message: 'Worker process terminated unexpectedly'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('worker-crash');
      expect(detectedErrors[0].description).toContain('Worker process crashed');
    });

    it('should detect communication timeout errors', () => {
      const baseTime = Date.now();
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 50 }, baseTime),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {}, baseTime + 35000) // 35 second gap
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('communication-timeout');
      expect(detectedErrors[0].description).toContain('Communication timeout detected');
    });

    it('should detect invalid metadata errors', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('session-state', mockNodeId, {
          metadata: {
            nodeId: '', // Invalid: empty nodeId
            buildType: 'new',
            stages: ['initialization']
          }
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('invalid-metadata');
      expect(detectedErrors[0].description).toContain('Invalid metadata');
    });

    it('should detect session timeout errors', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('session-state', mockNodeId, {
          status: 'timeout',
          error: 'Session exceeded maximum duration'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('session-timeout');
      expect(detectedErrors[0].description).toContain('Session timeout detected');
    });

    it('should detect subscriber callback failure errors', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'subscriber-error',
          message: 'Subscriber callback failed with exception'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('subscriber-callback-failure');
      expect(detectedErrors[0].description).toContain('Subscriber callback execution failed');
    });

    it('should handle empty events array', () => {
      const detectedErrors = errorHandler.detectErrors([], mockNodeId);
      expect(detectedErrors).toHaveLength(0);
    });

    it('should throw on contract violation - null events', () => {
      expect(() => {
        errorHandler.detectErrors(null as any, mockNodeId);
      }).toThrow('Contract violation: events must be provided');
    });

    it('should throw on contract violation - invalid nodeId', () => {
      expect(() => {
        errorHandler.detectErrors([], '');
      }).toThrow('Contract violation: nodeId must be non-empty string');
    });
  });

  describe('Error Classification', () => {
    it('should classify worker crash as critical severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error-1',
        category: 'worker-crash',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Worker crashed',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.category).toBe('worker-crash');
      expect(classification.severity).toBe('critical');
      expect(classification.urgency).toBe('critical');
      expect(classification.impact).toContain('Complete session failure');
      expect(classification.recommendedActions).toContain('Restart worker process');
    });

    it('should classify communication timeout as high severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error-2',
        category: 'communication-timeout',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Communication timeout',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.category).toBe('communication-timeout');
      expect(classification.severity).toBe('high');
      expect(classification.urgency).toBe('high');
      expect(classification.impact).toContain('Event delivery disruption');
      expect(classification.recommendedActions).toContain('Retry communication with exponential backoff');
    });

    it('should classify invalid metadata as high severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error-3',
        category: 'invalid-metadata',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Invalid metadata',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.category).toBe('invalid-metadata');
      expect(classification.severity).toBe('high');
      expect(classification.urgency).toBe('high');
      expect(classification.impact).toContain('Session initialization failure');
      expect(classification.recommendedActions).toContain('Validate and sanitize metadata');
    });

    it('should classify session timeout as medium severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error-4',
        category: 'session-timeout',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Session timeout',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.category).toBe('session-timeout');
      expect(classification.severity).toBe('medium');
      expect(classification.urgency).toBe('medium');
      expect(classification.impact).toContain('Session cleanup required');
      expect(classification.recommendedActions).toContain('Extend session timeout');
    });

    it('should classify subscriber callback failure as medium severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error-5',
        category: 'subscriber-callback-failure',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Callback failure',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.category).toBe('subscriber-callback-failure');
      expect(classification.severity).toBe('medium');
      expect(classification.urgency).toBe('medium');
      expect(classification.impact).toContain('UI update failure');
      expect(classification.recommendedActions).toContain('Isolate failing subscriber');
    });

    it('should throw on contract violation - invalid error', () => {
      expect(() => {
        errorHandler.classifyError(null as any);
      }).toThrow('Contract violation: error must be valid ErrorDetectionResult');
    });

    it('should throw on contract violation - invalid category', () => {
      const error: ErrorDetectionResult = {
        errorId: 'test-error',
        category: 'invalid-category' as ErrorCategory,
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Test error',
        context: {}
      };

      expect(() => {
        errorHandler.classifyError(error);
      }).toThrow('Contract violation: invalid error category');
    });
  });

  describe('Error Recovery', () => {
    it('should attempt recovery for worker crash', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'test-error-1',
        category: 'worker-crash',
        severity: 'critical',
        impact: 'Complete session failure',
        urgency: 'critical',
        isRecurring: false,
        cascadeRisk: 'high',
        recommendedActions: ['Restart worker process'],
        estimatedRecoveryTime: 30000
      };

      const result = await errorHandler.recoverFromError(mockSessionId, classification);

      expect(result.success).toBeDefined();
      expect(result.recoveryTime).toBeGreaterThan(0);
      expect(result.strategyUsed).toBeDefined();
      expect(['restart-worker', 'fallback-to-main-thread', 'all-failed']).toContain(result.strategyUsed);
    });

    it('should attempt recovery for communication timeout', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'test-error-2',
        category: 'communication-timeout',
        severity: 'high',
        impact: 'Event delivery disruption',
        urgency: 'high',
        isRecurring: false,
        cascadeRisk: 'medium',
        recommendedActions: ['Retry communication'],
        estimatedRecoveryTime: 10000
      };

      const result = await errorHandler.recoverFromError(mockSessionId, classification);

      expect(result.success).toBeDefined();
      expect(result.recoveryTime).toBeGreaterThan(0);
      expect(result.strategyUsed).toBeDefined();
      expect(['retry-with-backoff', 'reset-connection', 'all-failed']).toContain(result.strategyUsed);
    });

    it('should handle recovery failure gracefully', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'test-error-3',
        category: 'invalid-metadata',
        severity: 'high',
        impact: 'Session initialization failure',
        urgency: 'high',
        isRecurring: false,
        cascadeRisk: 'high',
        recommendedActions: ['Validate metadata'],
        estimatedRecoveryTime: 5000
      };

      // Multiple attempts may be needed for this test to show failure
      const result = await errorHandler.recoverFromError(mockSessionId, classification);

      expect(result.success).toBeDefined();
      expect(result.recoveryTime).toBeGreaterThan(0);
      expect(result.strategyUsed).toBeDefined();
    });

    it('should throw on contract violation - invalid sessionId', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'test-error',
        category: 'worker-crash',
        severity: 'critical',
        impact: 'Test impact',
        urgency: 'critical',
        isRecurring: false,
        cascadeRisk: 'high',
        recommendedActions: [],
        estimatedRecoveryTime: 1000
      };

      await expect(
        errorHandler.recoverFromError('', classification)
      ).rejects.toThrow('Contract violation: sessionId must be non-empty string');
    });

    it('should throw on contract violation - invalid classification', async () => {
      await expect(
        errorHandler.recoverFromError(mockSessionId, null as any)
      ).rejects.toThrow('Contract violation: classification must be valid ErrorClassificationResult');
    });
  });

  describe('Recoverability Check', () => {
    it('should correctly identify recoverable error categories', () => {
      expect(errorHandler.isRecoverable('worker-crash')).toBe(true);
      expect(errorHandler.isRecoverable('communication-timeout')).toBe(true);
      expect(errorHandler.isRecoverable('session-timeout')).toBe(true);
      expect(errorHandler.isRecoverable('subscriber-callback-failure')).toBe(true);
    });

    it('should correctly identify non-recoverable error categories', () => {
      expect(errorHandler.isRecoverable('invalid-metadata')).toBe(false);
    });

    it('should throw on contract violation - invalid category', () => {
      expect(() => {
        errorHandler.isRecoverable('invalid-category' as ErrorCategory);
      }).toThrow('Contract violation: invalid error category');
    });
  });

  describe('Error Statistics', () => {
    it('should return empty statistics for new handler', () => {
      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(0);
      expect(stats.recoveredErrors).toBe(0);
      expect(stats.recoveryRate).toBe(0);
      expect(stats.averageRecoveryTime).toBe(0);
      expect(stats.mostCommonCategory).toBeNull();
    });

    it('should return session-specific statistics', () => {
      const stats = errorHandler.getErrorStatistics(mockSessionId);

      expect(stats.totalErrors).toBe(0);
      expect(stats.recoveredErrors).toBe(0);
      expect(stats.recoveryRate).toBe(0);
      expect(stats.averageRecoveryTime).toBe(0);
      expect(stats.mostCommonCategory).toBeNull();
    });

    it('should throw on contract violation - invalid sessionId', () => {
      expect(() => {
        errorHandler.getErrorStatistics('');
      }).toThrow('Contract violation: sessionId must be non-empty string if provided');
    });
  });

  describe('Error History Management', () => {
    it('should clear all error history', () => {
      errorHandler.clearErrorHistory();
      
      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
    });

    it('should clear session-specific error history', () => {
      errorHandler.clearErrorHistory(mockSessionId);
      
      const stats = errorHandler.getErrorStatistics(mockSessionId);
      expect(stats.totalErrors).toBe(0);
    });

    it('should throw on contract violation - invalid sessionId', () => {
      expect(() => {
        errorHandler.clearErrorHistory('');
      }).toThrow('Contract violation: sessionId must be non-empty string if provided');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple errors in single event stream', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'worker-crash',
          message: 'Worker crashed'
        }),
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'subscriber-error',
          message: 'Callback failed'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(2);
      expect(detectedErrors[0].category).toBe('worker-crash');
      expect(detectedErrors[1].category).toBe('subscriber-callback-failure');
    });

    it('should handle events with no errors', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 50 }),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {})
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);
      expect(detectedErrors).toHaveLength(0);
    });

    it('should handle malformed event payloads gracefully', () => {
      const events: CapturedEvent[] = [
        {
          eventType: 'error',
          nodeId: mockNodeId,
          timestamp: Date.now(),
          sequenceNumber: 1,
          payload: null // Malformed payload
        }
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);
      expect(detectedErrors).toHaveLength(0); // Should not crash, just no errors detected
    });
  });
});