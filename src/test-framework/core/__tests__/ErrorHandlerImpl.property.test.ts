// ErrorHandlerImpl property-based tests
// Property 7: 例外分離 (Requirements 3.5, 6.2)
// Property 12: エラー伝播・処理 (Requirements 6.1, 6.3, 6.4, 6.5)

import fc from 'fast-check';
import { ErrorHandlerImpl } from '../ErrorHandlerImpl.js';
import { EventCaptureImpl } from '../EventCaptureImpl.js';
import { MockUtils } from '../../utils/MockUtils.js';
import {
  runPropertyTest,
  runPerformancePropertyTest
} from '../../config/fast-check.config.js';
import type {
  ErrorCategory,
  ErrorDetectionResult,
  ErrorClassificationResult
} from '../ErrorHandler.js';
import type {
  CapturedEvent,
  NotificationType
} from '../../types/EventTypes.js';
import type {
  NodeId,
  SessionId
} from '../../types/SessionTypes.js';

describe('ErrorHandlerImpl Property Tests', () => {
  let errorHandler: ErrorHandlerImpl;
  let eventCapture: EventCaptureImpl;

  beforeEach(() => {
    errorHandler = new ErrorHandlerImpl();
    eventCapture = new EventCaptureImpl();
  });

  describe('Property 7: 例外分離 (Requirements 3.5, 6.2)', () => {
    /**
     * Property: Exception isolation consistency
     * 
     * For any subscriber callback failure:
     * 1. Failing subscriber should be isolated without affecting others
     * 2. Event delivery should continue to healthy subscribers
     * 3. System should remain stable despite individual failures
     * 4. Recovery should restore isolated subscriber functionality
     * 5. No cascade failures should occur from isolated exceptions
     */
    it('should isolate subscriber callback failures consistently', () => {
      const isolationTestGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        healthySubscriberCount: fc.integer({ min: 2, max: 10 }),
        failingSubscriberCount: fc.integer({ min: 1, max: 3 }),
        eventCount: fc.integer({ min: 5, max: 20 }),
        failureRate: fc.float({ min: 0.1, max: 0.8 }) // 10-80% failure rate
      });

      runPropertyTest(
        isolationTestGenerator,
        async (input) => {
          // Create events with subscriber callback failures
          const events: CapturedEvent[] = [];
          
          for (let i = 0; i < input.eventCount; i++) {
            // Mix normal events with callback failure events
            if (Math.random() < input.failureRate) {
              events.push(MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId));
            } else {
              events.push(MockUtils.createMockEvent(
                'task-progress',
                input.nodeId as NodeId,
                { progress: Math.floor(Math.random() * 100) }
              ));
            }
          }

          // Detect errors
          const detectedErrors = errorHandler.detectErrors(events, input.nodeId as NodeId);
          const callbackErrors = detectedErrors.filter(e => e.category === 'subscriber-callback-failure');

          // Property: Callback failures should be detected
          if (callbackErrors.length === 0 && events.some(e => e.eventType === 'error')) {
            return false; // Should have detected callback failures
          }

          // Test isolation for each detected callback error
          let allIsolationSuccessful = true;

          for (const error of callbackErrors) {
            const classification = errorHandler.classifyError(error);
            
            // Property: Callback failures should be classified as recoverable
            if (!errorHandler.isRecoverable(classification.category)) {
              allIsolationSuccessful = false;
              break;
            }

            // Property: Cascade risk should be low for callback failures
            if (classification.cascadeRisk !== 'low') {
              allIsolationSuccessful = false;
              break;
            }

            // Property: Recovery should be attempted
            const sessionId = `test-session-${Date.now()}` as SessionId;
            const recoveryResult = await errorHandler.recoverFromError(sessionId, classification);
            
            // Property: Recovery should use isolation strategy
            if (recoveryResult.strategyUsed !== 'isolate-failing-subscriber' && 
                recoveryResult.strategyUsed !== 'reset-subscriber-state' &&
                recoveryResult.strategyUsed !== 'all-failed') {
              allIsolationSuccessful = false;
              break;
            }
          }

          return allIsolationSuccessful;
        }
      );
    });

    it('should maintain system stability during exception isolation', () => {
      const stabilityTestGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        concurrentFailures: fc.integer({ min: 1, max: 5 }),
        systemLoadLevel: fc.integer({ min: 1, max: 10 }),
        isolationDelayMs: fc.integer({ min: 1, max: 100 })
      });

      runPropertyTest(
        stabilityTestGenerator,
        async (input) => {
          // Create multiple concurrent callback failures
          const failureEvents: CapturedEvent[] = [];
          
          for (let i = 0; i < input.concurrentFailures; i++) {
            failureEvents.push(MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId));
          }

          // Add system load events
          for (let i = 0; i < input.systemLoadLevel; i++) {
            failureEvents.push(MockUtils.createMockEvent(
              'task-progress',
              input.nodeId as NodeId,
              { progress: Math.floor(Math.random() * 100) }
            ));
          }

          // Detect and handle errors concurrently
          const detectedErrors = errorHandler.detectErrors(failureEvents, input.nodeId as NodeId);
          const callbackErrors = detectedErrors.filter(e => e.category === 'subscriber-callback-failure');

          // Property: System should handle concurrent failures
          let systemStable = true;
          const recoveryPromises: Promise<any>[] = [];

          for (const error of callbackErrors) {
            try {
              const classification = errorHandler.classifyError(error);
              const sessionId = `test-session-${Date.now()}-${Math.random()}` as SessionId;
              
              const recoveryPromise = errorHandler.recoverFromError(sessionId, classification)
                .then(result => {
                  // Property: Recovery should not throw exceptions
                  return result.success !== undefined; // Should have success field
                })
                .catch(() => {
                  systemStable = false;
                  return false;
                });
              
              recoveryPromises.push(recoveryPromise);
            } catch (error) {
              systemStable = false;
              break;
            }
          }

          // Wait for all recovery attempts
          const recoveryResults = await Promise.all(recoveryPromises);
          
          // Property: All recovery attempts should complete without system crash
          const allRecoveryAttemptsCompleted = recoveryResults.every(result => typeof result === 'boolean');

          return systemStable && allRecoveryAttemptsCompleted;
        }
      );
    });

    it('should prevent cascade failures from isolated exceptions', () => {
      const cascadePreventionGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        initialFailureType: fc.constantFrom('subscriber-callback-failure' as ErrorCategory),
        subsequentEventCount: fc.integer({ min: 3, max: 15 }),
        monitoringDurationMs: fc.integer({ min: 100, max: 500 })
      });

      runPropertyTest(
        cascadePreventionGenerator,
        async (input) => {
          // Create initial failure
          const initialFailureEvent = MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId);
          
          // Create subsequent events that could be affected by cascade
          const subsequentEvents: CapturedEvent[] = [];
          for (let i = 0; i < input.subsequentEventCount; i++) {
            subsequentEvents.push(MockUtils.createMockEvent(
              'task-progress',
              input.nodeId as NodeId,
              { progress: Math.floor(Math.random() * 100) },
              Date.now() + (i * 10) // Spread events over time
            ));
          }

          const allEvents = [initialFailureEvent, ...subsequentEvents];

          // Detect initial error
          const initialErrors = errorHandler.detectErrors([initialFailureEvent], input.nodeId as NodeId);
          
          if (initialErrors.length === 0) {
            return true; // No error detected, no cascade possible
          }

          const initialError = initialErrors[0];
          const classification = errorHandler.classifyError(initialError);

          // Attempt recovery
          const sessionId = `test-session-${Date.now()}` as SessionId;
          await errorHandler.recoverFromError(sessionId, classification);

          // Monitor for cascade failures in subsequent events
          const allDetectedErrors = errorHandler.detectErrors(allEvents, input.nodeId as NodeId);
          
          // Property: No additional error categories should appear due to cascade
          const errorCategories = new Set(allDetectedErrors.map(e => e.category));
          const hasCascadeFailure = errorCategories.size > 1 && 
                                   errorCategories.has('worker-crash') || 
                                   errorCategories.has('session-timeout');

          // Property: Subsequent events should not be corrupted by initial failure
          const subsequentErrors = errorHandler.detectErrors(subsequentEvents, input.nodeId as NodeId);
          const hasSubsequentErrors = subsequentErrors.length > 0;

          return !hasCascadeFailure && !hasSubsequentErrors;
        }
      );
    });
  });

  describe('Property 12: エラー伝播・処理 (Requirements 6.1, 6.3, 6.4, 6.5)', () => {
    /**
     * Property: Error propagation and handling consistency
     * 
     * For any error category:
     * 1. Errors should be detected accurately from event streams
     * 2. Error classification should be consistent and appropriate
     * 3. Recovery strategies should be applied based on error category
     * 4. Error propagation should be controlled and predictable
     * 5. System should maintain operational state during error handling
     */
    it('should handle error propagation consistently across all categories', () => {
      const errorPropagationGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        errorCategory: fc.constantFrom(
          'worker-crash' as ErrorCategory,
          'communication-timeout' as ErrorCategory,
          'invalid-metadata' as ErrorCategory,
          'session-timeout' as ErrorCategory,
          'subscriber-callback-failure' as ErrorCategory
        ),
        errorCount: fc.integer({ min: 1, max: 5 }),
        propagationDelayMs: fc.integer({ min: 10, max: 200 })
      });

      runPropertyTest(
        errorPropagationGenerator,
        async (input) => {
          // Create error events based on category
          const errorEvents: CapturedEvent[] = [];
          
          for (let i = 0; i < input.errorCount; i++) {
            let errorEvent: CapturedEvent;
            
            switch (input.errorCategory) {
              case 'worker-crash':
                errorEvent = MockUtils.createMockWorkerCrashEvent(input.nodeId as NodeId);
                break;
              case 'communication-timeout':
                const timeoutEvents = MockUtils.createMockTimeoutEventSequence(input.nodeId as NodeId);
                errorEvents.push(...timeoutEvents);
                continue;
              case 'invalid-metadata':
                errorEvent = MockUtils.createMockInvalidMetadataEvent(input.nodeId as NodeId, 'nodeId');
                break;
              case 'session-timeout':
                errorEvent = MockUtils.createMockSessionTimeoutEvent(input.nodeId as NodeId);
                break;
              case 'subscriber-callback-failure':
                errorEvent = MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId);
                break;
              default:
                return false; // Invalid category
            }
            
            errorEvents.push(errorEvent);
          }

          // Property: Error detection should be accurate
          const detectedErrors = errorHandler.detectErrors(errorEvents, input.nodeId as NodeId);
          
          if (detectedErrors.length === 0) {
            return false; // Should have detected errors
          }

          // Property: All detected errors should match expected category
          const allMatchExpectedCategory = detectedErrors.every(error => 
            error.category === input.errorCategory
          );

          if (!allMatchExpectedCategory) {
            return false;
          }

          // Property: Error classification should be consistent
          let classificationConsistent = true;
          const sessionId = `test-session-${Date.now()}` as SessionId;

          for (const error of detectedErrors) {
            const classification = errorHandler.classifyError(error);
            
            // Property: Classification should match error category
            if (classification.category !== error.category) {
              classificationConsistent = false;
              break;
            }

            // Property: Severity should be appropriate for category
            const expectedSeverity = this.getExpectedSeverity(input.errorCategory);
            if (classification.severity !== expectedSeverity) {
              classificationConsistent = false;
              break;
            }

            // Property: Recovery should be attempted
            const recoveryResult = await errorHandler.recoverFromError(sessionId, classification);
            
            // Property: Recovery result should be valid
            if (typeof recoveryResult.success !== 'boolean' || 
                typeof recoveryResult.recoveryTime !== 'number' ||
                !recoveryResult.strategyUsed) {
              classificationConsistent = false;
              break;
            }
          }

          return classificationConsistent;
        }
      );
    });

    it('should maintain error handling performance under load', () => {
      const performanceTestGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        errorBurstSize: fc.integer({ min: 5, max: 50 }),
        errorTypes: fc.array(
          fc.constantFrom(
            'worker-crash' as ErrorCategory,
            'communication-timeout' as ErrorCategory,
            'subscriber-callback-failure' as ErrorCategory
          ),
          { minLength: 1, maxLength: 3 }
        ),
        maxProcessingTimeMs: fc.integer({ min: 100, max: 1000 })
      });

      runPerformancePropertyTest(
        performanceTestGenerator,
        async (input) => {
          // Create burst of mixed error events
          const errorEvents: CapturedEvent[] = [];
          
          for (let i = 0; i < input.errorBurstSize; i++) {
            const errorType = input.errorTypes[i % input.errorTypes.length];
            let errorEvent: CapturedEvent;
            
            switch (errorType) {
              case 'worker-crash':
                errorEvent = MockUtils.createMockWorkerCrashEvent(input.nodeId as NodeId);
                break;
              case 'communication-timeout':
                const timeoutEvents = MockUtils.createMockTimeoutEventSequence(input.nodeId as NodeId);
                errorEvent = timeoutEvents[1]; // Use the timeout event
                break;
              case 'subscriber-callback-failure':
                errorEvent = MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId);
                break;
              default:
                continue;
            }
            
            errorEvents.push(errorEvent);
          }

          // Measure error detection performance
          const detectionStartTime = Date.now();
          const detectedErrors = errorHandler.detectErrors(errorEvents, input.nodeId as NodeId);
          const detectionTime = Date.now() - detectionStartTime;

          // Property: Detection should complete within reasonable time
          if (detectionTime > input.maxProcessingTimeMs) {
            return false;
          }

          // Measure error classification and recovery performance
          const processingStartTime = Date.now();
          const sessionId = `test-session-${Date.now()}` as SessionId;
          
          const recoveryPromises = detectedErrors.map(async (error) => {
            const classification = errorHandler.classifyError(error);
            return await errorHandler.recoverFromError(sessionId, classification);
          });

          const recoveryResults = await Promise.all(recoveryPromises);
          const processingTime = Date.now() - processingStartTime;

          // Property: Processing should complete within reasonable time
          if (processingTime > input.maxProcessingTimeMs * 2) {
            return false;
          }

          // Property: All recovery attempts should complete
          const allRecoveryCompleted = recoveryResults.every(result => 
            typeof result.success === 'boolean'
          );

          return allRecoveryCompleted;
        }
      );
    });

    it('should handle error state transitions correctly', () => {
      const stateTransitionGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        errorSequence: fc.array(
          fc.constantFrom(
            'worker-crash' as ErrorCategory,
            'communication-timeout' as ErrorCategory,
            'session-timeout' as ErrorCategory,
            'subscriber-callback-failure' as ErrorCategory
          ),
          { minLength: 2, maxLength: 8 }
        ),
        transitionDelayMs: fc.integer({ min: 10, max: 100 })
      });

      runPropertyTest(
        stateTransitionGenerator,
        async (input) => {
          const sessionId = `test-session-${Date.now()}` as SessionId;
          let systemState = 'healthy';
          let stateTransitionsValid = true;

          // Process error sequence
          for (let i = 0; i < input.errorSequence.length; i++) {
            const errorCategory = input.errorSequence[i];
            
            // Create error event
            let errorEvent: CapturedEvent;
            switch (errorCategory) {
              case 'worker-crash':
                errorEvent = MockUtils.createMockWorkerCrashEvent(input.nodeId as NodeId);
                break;
              case 'communication-timeout':
                const timeoutEvents = MockUtils.createMockTimeoutEventSequence(input.nodeId as NodeId);
                errorEvent = timeoutEvents[1];
                break;
              case 'session-timeout':
                errorEvent = MockUtils.createMockSessionTimeoutEvent(input.nodeId as NodeId);
                break;
              case 'subscriber-callback-failure':
                errorEvent = MockUtils.createMockCallbackFailureEvent(input.nodeId as NodeId);
                break;
              default:
                continue;
            }

            // Detect and handle error
            const detectedErrors = errorHandler.detectErrors([errorEvent], input.nodeId as NodeId);
            
            if (detectedErrors.length > 0) {
              const error = detectedErrors[0];
              const classification = errorHandler.classifyError(error);
              
              // Property: State transition should be valid
              const expectedNewState = this.getExpectedStateAfterError(systemState, errorCategory);
              
              const recoveryResult = await errorHandler.recoverFromError(sessionId, classification);
              
              // Property: Recovery should affect system state appropriately
              if (recoveryResult.success) {
                systemState = 'recovering';
              } else {
                systemState = 'failed';
              }

              // Property: State should be consistent with error severity
              if (classification.severity === 'critical' && systemState === 'healthy') {
                stateTransitionsValid = false;
                break;
              }
            }

            // Add delay between errors
            await new Promise(resolve => setTimeout(resolve, input.transitionDelayMs));
          }

          return stateTransitionsValid;
        }
      );
    });

    it('should enforce error handling contracts consistently', () => {
      const contractEnforcementGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        invalidInputType: fc.constantFrom(
          'null-events',
          'empty-nodeId',
          'invalid-error-object',
          'invalid-classification'
        ),
        validationStrictness: fc.constantFrom('strict', 'permissive')
      });

      runPropertyTest(
        contractEnforcementGenerator,
        async (input) => {
          let contractViolationDetected = false;

          try {
            switch (input.invalidInputType) {
              case 'null-events':
                errorHandler.detectErrors(null as any, input.nodeId as NodeId);
                break;
              
              case 'empty-nodeId':
                const validEvents = [MockUtils.createMockWorkerCrashEvent('valid-node')];
                errorHandler.detectErrors(validEvents, '');
                break;
              
              case 'invalid-error-object':
                errorHandler.classifyError(null as any);
                break;
              
              case 'invalid-classification':
                const sessionId = `test-session-${Date.now()}` as SessionId;
                await errorHandler.recoverFromError(sessionId, null as any);
                break;
            }
          } catch (error) {
            // Property: Contract violations should throw errors with specific messages
            const errorMessage = error instanceof Error ? error.message : String(error);
            contractViolationDetected = errorMessage.includes('Contract violation');
          }

          // Property: Contract violations should be detected and reported
          return contractViolationDetected;
        }
      );
    });
  });

  // Private helper methods for property test validation

  private getExpectedSeverity(category: ErrorCategory): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case 'worker-crash':
        return 'critical';
      case 'communication-timeout':
      case 'invalid-metadata':
        return 'high';
      case 'session-timeout':
      case 'subscriber-callback-failure':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private getExpectedStateAfterError(currentState: string, errorCategory: ErrorCategory): string {
    switch (errorCategory) {
      case 'worker-crash':
        return 'failed';
      case 'communication-timeout':
        return currentState === 'healthy' ? 'degraded' : 'failed';
      case 'invalid-metadata':
        return 'failed';
      case 'session-timeout':
        return 'timeout';
      case 'subscriber-callback-failure':
        return currentState; // Should not affect overall system state
      default:
        return currentState;
    }
  }
});