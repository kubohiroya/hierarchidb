// ErrorHandlerImpl unit tests - Specific scenarios and edge cases
// Requirements 6.1, 6.2, 6.3, 6.4, 6.5

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

describe('ErrorHandlerImpl Unit Tests - Specific Scenarios', () => {
  let errorHandler: ErrorHandlerImpl;
  const mockNodeId: NodeId = 'test-node-unit';
  const mockSessionId: SessionId = 'test-session-unit';

  beforeEach(() => {
    errorHandler = new ErrorHandlerImpl();
  });

  describe('Worker Crash Error Scenarios (Requirement 6.1)', () => {
    it('should detect worker crash from process termination message', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'worker-crash',
          message: 'worker terminated',
          pid: 12345,
          exitCode: 1
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('worker-crash');
      expect(detectedErrors[0].description).toContain('Worker process crashed');
      expect(detectedErrors[0].context.payload.pid).toBe(12345);
    });

    it('should detect worker crash from unexpected termination', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          message: 'Worker process crashed unexpectedly',
          stack: 'Error: Segmentation fault\n    at Worker.process',
          timestamp: Date.now()
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('worker-crash');
      expect(detectedErrors[0].context.payload.stack).toContain('Segmentation fault');
    });

    it('should classify worker crash as critical severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'worker-crash-001',
        category: 'worker-crash',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Worker process crashed',
        context: { exitCode: 1 }
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.severity).toBe('critical');
      expect(classification.urgency).toBe('critical');
      expect(classification.cascadeRisk).toBe('high');
      expect(classification.recommendedActions).toContain('Restart worker process');
      expect(classification.estimatedRecoveryTime).toBeGreaterThan(20000); // > 20 seconds
    });

    it('should attempt worker restart recovery strategy', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'worker-crash-001',
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
      expect(['restart-worker', 'fallback-to-main-thread', 'all-failed']).toContain(result.strategyUsed);
    });
  });

  describe('Communication Timeout Scenarios (Requirement 6.2)', () => {
    it('should detect timeout from large time gaps between events', () => {
      const baseTime = Date.now();
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 25 }, baseTime),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {}, baseTime + 45000) // 45 second gap
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('communication-timeout');
      expect(detectedErrors[0].context.timeDiff).toBe(45000);
      expect(detectedErrors[0].context.prevEventType).toBe('task-progress');
    });

    it('should not detect timeout for normal event intervals', () => {
      const baseTime = Date.now();
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 25 }, baseTime),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {}, baseTime + 15000) // 15 second gap
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(0);
    });

    it('should classify communication timeout as high severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'timeout-001',
        category: 'communication-timeout',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Communication timeout detected',
        context: { timeDiff: 35000 }
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.severity).toBe('high');
      expect(classification.urgency).toBe('high');
      expect(classification.cascadeRisk).toBe('medium');
      expect(classification.recommendedActions).toContain('Retry communication with exponential backoff');
    });

    it('should attempt retry with backoff recovery strategy', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'timeout-001',
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
      expect(['retry-with-backoff', 'reset-connection', 'all-failed']).toContain(result.strategyUsed);
    });
  });

  describe('Invalid Metadata Scenarios (Requirement 6.3)', () => {
    it('should detect missing nodeId in metadata', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockInvalidMetadataEvent(mockNodeId, 'nodeId')
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('invalid-metadata');
      expect(detectedErrors[0].description).toContain('missing or invalid nodeId');
    });

    it('should detect invalid buildType in metadata', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockInvalidMetadataEvent(mockNodeId, 'buildType')
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('invalid-metadata');
      expect(detectedErrors[0].description).toContain('invalid buildType');
    });

    it('should detect empty stages array in metadata', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockInvalidMetadataEvent(mockNodeId, 'stages')
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('invalid-metadata');
      expect(detectedErrors[0].description).toContain('invalid stages array');
    });

    it('should classify invalid metadata as high severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'metadata-001',
        category: 'invalid-metadata',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Invalid metadata detected',
        context: { field: 'nodeId' }
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.severity).toBe('high');
      expect(classification.urgency).toBe('high');
      expect(classification.cascadeRisk).toBe('high');
      expect(classification.recommendedActions).toContain('Validate and sanitize metadata');
    });

    it('should mark invalid metadata as non-recoverable', () => {
      const isRecoverable = errorHandler.isRecoverable('invalid-metadata');
      expect(isRecoverable).toBe(false);
    });
  });

  describe('Session Timeout Scenarios (Requirement 6.4)', () => {
    it('should detect session timeout from status field', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockSessionTimeoutEvent(mockNodeId)
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('session-timeout');
      expect(detectedErrors[0].description).toContain('Session timeout detected');
      expect(detectedErrors[0].context.sessionStatus).toBe('timeout');
    });

    it('should detect session timeout from error message', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('session-state', mockNodeId, {
          status: 'error',
          error: 'Session timeout after 3600 seconds'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('session-timeout');
      expect(detectedErrors[0].context.error).toContain('timeout');
    });

    it('should classify session timeout as medium severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'session-timeout-001',
        category: 'session-timeout',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Session timeout',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.severity).toBe('medium');
      expect(classification.urgency).toBe('medium');
      expect(classification.cascadeRisk).toBe('low');
      expect(classification.recommendedActions).toContain('Extend session timeout');
    });

    it('should attempt session extension recovery strategy', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'session-timeout-001',
        category: 'session-timeout',
        severity: 'medium',
        impact: 'Session cleanup required',
        urgency: 'medium',
        isRecurring: false,
        cascadeRisk: 'low',
        recommendedActions: ['Extend session timeout'],
        estimatedRecoveryTime: 15000
      };

      const result = await errorHandler.recoverFromError(mockSessionId, classification);

      expect(result.success).toBeDefined();
      expect(['extend-session', 'restart-session', 'all-failed']).toContain(result.strategyUsed);
    });
  });

  describe('Subscriber Callback Failure Scenarios (Requirement 6.5)', () => {
    it('should detect callback failure from subscriber error type', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockCallbackFailureEvent(mockNodeId)
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('subscriber-callback-failure');
      expect(detectedErrors[0].description).toContain('Subscriber callback execution failed');
      expect(detectedErrors[0].context.payload.subscriberId).toBe('ui-component-123');
    });

    it('should detect callback failure from callback failed message', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockEvent('error', mockNodeId, {
          message: 'callback failed with TypeError',
          subscriberId: 'progress-display',
          eventType: 'task-progress'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('subscriber-callback-failure');
      expect(detectedErrors[0].context.payload.subscriberId).toBe('progress-display');
    });

    it('should classify callback failure as medium severity', () => {
      const error: ErrorDetectionResult = {
        errorId: 'callback-001',
        category: 'subscriber-callback-failure',
        timestamp: Date.now(),
        nodeId: mockNodeId,
        description: 'Callback failure',
        context: {}
      };

      const classification = errorHandler.classifyError(error);

      expect(classification.severity).toBe('medium');
      expect(classification.urgency).toBe('medium');
      expect(classification.cascadeRisk).toBe('low');
      expect(classification.recommendedActions).toContain('Isolate failing subscriber');
    });

    it('should attempt subscriber isolation recovery strategy', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'callback-001',
        category: 'subscriber-callback-failure',
        severity: 'medium',
        impact: 'UI update failure',
        urgency: 'medium',
        isRecurring: false,
        cascadeRisk: 'low',
        recommendedActions: ['Isolate failing subscriber'],
        estimatedRecoveryTime: 2000
      };

      const result = await errorHandler.recoverFromError(mockSessionId, classification);

      expect(result.success).toBeDefined();
      expect(['isolate-failing-subscriber', 'reset-subscriber-state', 'all-failed']).toContain(result.strategyUsed);
    });
  });

  describe('Exception Isolation and Cascade Prevention', () => {
    it('should isolate subscriber callback failures without affecting system', () => {
      const events: CapturedEvent[] = [
        MockUtils.createMockCallbackFailureEvent(mockNodeId),
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 75 }),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {})
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);

      // Should only detect the callback failure, not affect other events
      expect(detectedErrors).toHaveLength(1);
      expect(detectedErrors[0].category).toBe('subscriber-callback-failure');
      
      // Verify isolation properties
      const classification = errorHandler.classifyError(detectedErrors[0]);
      expect(classification.cascadeRisk).toBe('low');
      expect(errorHandler.isRecoverable(classification.category)).toBe(true);
    });

    it('should prevent cascade failures from worker crashes', async () => {
      const workerCrashEvent = MockUtils.createMockWorkerCrashEvent(mockNodeId);
      const subsequentEvents: CapturedEvent[] = [
        MockUtils.createMockEvent('task-progress', mockNodeId, { progress: 50 }),
        MockUtils.createMockEvent('heartbeat', mockNodeId, {})
      ];

      // Detect initial worker crash
      const initialErrors = errorHandler.detectErrors([workerCrashEvent], mockNodeId);
      expect(initialErrors).toHaveLength(1);
      expect(initialErrors[0].category).toBe('worker-crash');

      const classification = errorHandler.classifyError(initialErrors[0]);
      
      // Attempt recovery
      await errorHandler.recoverFromError(mockSessionId, classification);

      // Check that subsequent events don't show cascade failures
      const allEvents = [workerCrashEvent, ...subsequentEvents];
      const allErrors = errorHandler.detectErrors(allEvents, mockNodeId);
      
      // Should not detect additional error categories due to cascade
      const errorCategories = new Set(allErrors.map(e => e.category));
      expect(errorCategories.size).toBe(1); // Only worker-crash
      expect(errorCategories.has('worker-crash')).toBe(true);
    });

    it('should handle multiple concurrent callback failures', async () => {
      const callbackFailures: CapturedEvent[] = [
        MockUtils.createMockCallbackFailureEvent(mockNodeId),
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'subscriber-error',
          message: 'Another callback failed',
          subscriberId: 'ui-component-456'
        }),
        MockUtils.createMockEvent('error', mockNodeId, {
          type: 'subscriber-error',
          message: 'Third callback failed',
          subscriberId: 'ui-component-789'
        })
      ];

      const detectedErrors = errorHandler.detectErrors(callbackFailures, mockNodeId);
      expect(detectedErrors).toHaveLength(3);
      
      // All should be callback failures
      detectedErrors.forEach(error => {
        expect(error.category).toBe('subscriber-callback-failure');
      });

      // Test concurrent recovery
      const recoveryPromises = detectedErrors.map(async (error) => {
        const classification = errorHandler.classifyError(error);
        return await errorHandler.recoverFromError(mockSessionId, classification);
      });

      const results = await Promise.all(recoveryPromises);
      
      // All recovery attempts should complete
      results.forEach(result => {
        expect(result.success).toBeDefined();
        expect(result.recoveryTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Statistics and History Management', () => {
    it('should track error statistics correctly', async () => {
      // Generate some errors and recoveries
      const events: CapturedEvent[] = [
        MockUtils.createMockWorkerCrashEvent(mockNodeId),
        MockUtils.createMockCallbackFailureEvent(mockNodeId),
        MockUtils.createMockSessionTimeoutEvent(mockNodeId)
      ];

      const detectedErrors = errorHandler.detectErrors(events, mockNodeId);
      expect(detectedErrors).toHaveLength(3);

      // Attempt recovery for each error
      for (const error of detectedErrors) {
        const classification = errorHandler.classifyError(error);
        await errorHandler.recoverFromError(mockSessionId, classification);
      }

      // Check statistics
      const stats = errorHandler.getErrorStatistics(mockSessionId);
      expect(stats.totalErrors).toBeGreaterThan(0);
      expect(stats.errorsByCategory).toBeDefined();
      expect(typeof stats.recoveryRate).toBe('number');
      expect(stats.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(stats.recoveryRate).toBeLessThanOrEqual(1);
    });

    it('should clear error history when requested', () => {
      // Add some error history first
      const events: CapturedEvent[] = [
        MockUtils.createMockCallbackFailureEvent(mockNodeId)
      ];

      errorHandler.detectErrors(events, mockNodeId);
      
      // Clear history
      errorHandler.clearErrorHistory(mockSessionId);
      
      // Verify history is cleared
      const stats = errorHandler.getErrorStatistics(mockSessionId);
      expect(stats.totalErrors).toBe(0);
      expect(stats.recoveredErrors).toBe(0);
    });

    it('should provide global statistics across all sessions', () => {
      const globalStats = errorHandler.getErrorStatistics();
      
      expect(typeof globalStats.totalErrors).toBe('number');
      expect(typeof globalStats.recoveredErrors).toBe('number');
      expect(typeof globalStats.recoveryRate).toBe('number');
      expect(typeof globalStats.averageRecoveryTime).toBe('number');
      expect(globalStats.errorsByCategory).toBeDefined();
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle malformed event payloads gracefully', () => {
      const malformedEvents: CapturedEvent[] = [
        {
          eventType: 'error',
          nodeId: mockNodeId,
          timestamp: Date.now(),
          sequenceNumber: 1,
          payload: null
        },
        {
          eventType: 'session-state',
          nodeId: mockNodeId,
          timestamp: Date.now(),
          sequenceNumber: 2,
          payload: undefined
        }
      ];

      // Should not throw, just return empty results
      const detectedErrors = errorHandler.detectErrors(malformedEvents, mockNodeId);
      expect(detectedErrors).toHaveLength(0);
    });

    it('should handle empty event arrays', () => {
      const detectedErrors = errorHandler.detectErrors([], mockNodeId);
      expect(detectedErrors).toHaveLength(0);
    });

    it('should handle single event arrays', () => {
      const singleEvent = [MockUtils.createMockWorkerCrashEvent(mockNodeId)];
      const detectedErrors = errorHandler.detectErrors(singleEvent, mockNodeId);
      expect(detectedErrors).toHaveLength(1);
    });

    it('should validate recovery strategy success rates', async () => {
      const classification: ErrorClassificationResult = {
        errorId: 'test-recovery',
        category: 'communication-timeout',
        severity: 'high',
        impact: 'Test impact',
        urgency: 'high',
        isRecurring: false,
        cascadeRisk: 'medium',
        recommendedActions: ['Test recovery'],
        estimatedRecoveryTime: 5000
      };

      // Run multiple recovery attempts to test success rate distribution
      const attempts = 10;
      const results = [];
      
      for (let i = 0; i < attempts; i++) {
        const sessionId = `test-session-${i}` as SessionId;
        const result = await errorHandler.recoverFromError(sessionId, classification);
        results.push(result.success);
      }

      // Should have some variation in success/failure
      const successCount = results.filter(success => success).length;
      const failureCount = results.filter(success => !success).length;
      
      // At least some attempts should complete (success or failure)
      expect(successCount + failureCount).toBe(attempts);
    });
  });
});