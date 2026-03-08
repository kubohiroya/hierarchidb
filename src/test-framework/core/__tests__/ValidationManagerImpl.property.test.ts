// ValidationManagerImpl property-based tests
// Property 2: 進捗イベントUI反映 (Requirements 1.3, 1.5, 2.4, 2.7)
// Property 14: メモリ使用量境界 (Requirements 7.4)

import fc from 'fast-check';
import { ValidationManagerImpl } from '../ValidationManagerImpl.js';
import { MockUtils } from '../../utils/MockUtils.js';
import {
  createPropertyTestParams,
  createPerformanceTestParams,
  runPropertyTest,
  runPerformancePropertyTest
} from '../../config/fast-check.config.js';
import type {
  ExpectedProgress,
  ExpectedUIState
} from '../../types/ValidationTypes.js';
import type {
  PerformanceMetrics,
  PerformanceConstraints,
  ResourceUsage,
  ResourceLimits
} from '../../types/PerformanceTypes.js';
import type { NodeId } from '../../types/SessionTypes.js';

describe('ValidationManagerImpl Property Tests', () => {
  let validationManager: ValidationManagerImpl;

  beforeEach(() => {
    validationManager = new ValidationManagerImpl();
  });

  describe('Property 2: 進捗イベントUI反映 (Requirements 1.3, 1.5, 2.4, 2.7)', () => {
    /**
     * Property: Progress event UI reflection consistency
     * 
     * For any valid progress event, the validation should:
     * 1. Accept valid progress values (0..100)
     * 2. Reject invalid progress values (outside 0..100, NaN, Infinity)
     * 3. Maintain consistency across multiple validations
     * 4. Preserve validation state between calls
     */
    it('should maintain progress validation consistency across all valid inputs', () => {
      const validProgressGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        taskId: fc.string({ minLength: 1, maxLength: 50 }),
        expectedValue: fc.integer({ min: 0, max: 100 }),
        tolerance: fc.option(fc.integer({ min: 0, max: 10 })),
        timestamp: fc.option(fc.integer({ min: 1, max: Date.now() }))
      });

      runPropertyTest(
        validProgressGenerator,
        async (input) => {
          const expectedProgress: ExpectedProgress = {
            taskId: input.taskId,
            expectedValue: input.expectedValue,
            ...(input.tolerance !== null && { tolerance: input.tolerance }),
            ...(input.timestamp !== null && { timestamp: input.timestamp })
          };

          const result = validationManager.validateProgressDisplay(
            input.nodeId as NodeId,
            expectedProgress
          );

          // Property: Valid progress values should always pass validation
          return result.isValid && result.errors.length === 0;
        }
      );
    });

    it('should consistently reject invalid progress values', () => {
      const invalidProgressGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        taskId: fc.string({ minLength: 1, maxLength: 50 }),
        expectedValue: fc.oneof(
          fc.integer({ min: -1000, max: -1 }), // Negative values
          fc.integer({ min: 101, max: 1000 }), // Values > 100
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        )
      });

      runPropertyTest(
        invalidProgressGenerator,
        async (input) => {
          const expectedProgress: ExpectedProgress = {
            taskId: input.taskId,
            expectedValue: input.expectedValue
          };

          const result = validationManager.validateProgressDisplay(
            input.nodeId as NodeId,
            expectedProgress
          );

          // Property: Invalid progress values should always fail validation
          // with critical severity (contract violation prohibition)
          return !result.isValid && 
                 result.errors.length > 0 &&
                 result.errors.some(error => 
                   error.code === 'INVALID_PROGRESS_VALUE' && 
                   error.severity === 'critical'
                 );
        }
      );
    });

    it('should maintain UI state validation consistency', () => {
      const uiStateGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        emptyStateContent: fc.option(fc.constant('No tasks yet.')),
        displayStatus: fc.option(fc.oneof(
          fc.constant('running'),
          fc.constant('paused'),
          fc.constant('completed'),
          fc.constant('error')
        )),
        taskCount: fc.option(fc.integer({ min: 0, max: 10000 })),
        progressValues: fc.option(fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 100 })
        ))
      });

      runPropertyTest(
        uiStateGenerator,
        async (input) => {
          const expectedState: ExpectedUIState = {};
          
          if (input.emptyStateContent !== null) {
            expectedState.emptyStateContent = input.emptyStateContent;
          }
          if (input.displayStatus !== null) {
            expectedState.displayStatus = input.displayStatus;
          }
          if (input.taskCount !== null) {
            expectedState.taskCount = input.taskCount;
          }
          if (input.progressValues !== null) {
            expectedState.progressValues = input.progressValues;
          }

          const result = validationManager.validateStep5Display(
            input.nodeId as NodeId,
            expectedState
          );

          // Property: Valid UI state should pass validation
          // All generated values are valid by construction
          return result.isValid;
        }
      );
    });

    it('should detect progress value contract violations consistently', () => {
      const contractViolationGenerator = fc.record({
        nodeId: fc.string({ minLength: 1, maxLength: 50 }),
        progressValues: fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(
            fc.integer({ min: -1000, max: -1 }),
            fc.integer({ min: 101, max: 1000 }),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity)
          )
        )
      });

      runPropertyTest(
        contractViolationGenerator,
        async (input) => {
          const expectedState: ExpectedUIState = {
            progressValues: input.progressValues
          };

          const result = validationManager.validateStep5Display(
            input.nodeId as NodeId,
            expectedState
          );

          // Property: Contract violations should be immediately visible
          // Each invalid progress value should generate a critical error
          const expectedErrorCount = Object.keys(input.progressValues).length;
          const criticalErrors = result.errors.filter(error => 
            error.code === 'INVALID_PROGRESS_VALUE' && 
            error.severity === 'critical'
          );

          return !result.isValid && 
                 criticalErrors.length === expectedErrorCount;
        }
      );
    });
  });

  describe('Property 14: メモリ使用量境界 (Requirements 7.4)', () => {
    /**
     * Property: Memory usage boundary validation
     * 
     * The system should:
     * 1. Accept memory usage within defined limits
     * 2. Detect and report memory usage violations
     * 3. Maintain consistent boundary checking
     * 4. Handle edge cases (exactly at limit, just over limit)
     */
    it('should consistently validate memory usage within bounds', () => {
      const validMemoryGenerator = fc.record({
        peakMemoryMB: fc.integer({ min: 1, max: 500 }),
        averageMemoryMB: fc.integer({ min: 1, max: 400 }),
        cpuUtilizationPercent: fc.integer({ min: 0, max: 100 }),
        eventBufferSize: fc.integer({ min: 1, max: 900 }),
        subscriberCount: fc.integer({ min: 1, max: 45 }),
        maxMemoryMB: fc.integer({ min: 501, max: 1000 }),
        maxCpuPercent: fc.integer({ min: 70, max: 100 }),
        maxEventBufferSize: fc.integer({ min: 901, max: 2000 }),
        maxSubscriberCount: fc.integer({ min: 46, max: 100 })
      });

      runPerformancePropertyTest(
        validMemoryGenerator,
        async (input) => {
          const usage: ResourceUsage = {
            peakMemoryMB: input.peakMemoryMB,
            averageMemoryMB: input.averageMemoryMB,
            cpuUtilizationPercent: input.cpuUtilizationPercent,
            eventBufferSize: input.eventBufferSize,
            subscriberCount: input.subscriberCount
          };

          const limits: ResourceLimits = {
            maxMemoryMB: input.maxMemoryMB,
            maxCpuPercent: input.maxCpuPercent,
            maxEventBufferSize: input.maxEventBufferSize,
            maxSubscriberCount: input.maxSubscriberCount
          };

          const result = validationManager.validateResourceUsage(usage, limits);

          // Property: Usage within limits should pass validation
          return result.isValid && result.errors.length === 0;
        }
      );
    });

    it('should detect memory boundary violations consistently', () => {
      const memoryViolationGenerator = fc.record({
        baseLimitMB: fc.integer({ min: 100, max: 500 }),
        violationAmountMB: fc.integer({ min: 1, max: 100 }),
        averageMemoryMB: fc.integer({ min: 1, max: 400 }),
        cpuUtilizationPercent: fc.integer({ min: 0, max: 100 }),
        eventBufferSize: fc.integer({ min: 1, max: 900 }),
        subscriberCount: fc.integer({ min: 1, max: 45 })
      });

      runPerformancePropertyTest(
        memoryViolationGenerator,
        async (input) => {
          const peakMemoryMB = input.baseLimitMB + input.violationAmountMB;
          
          const usage: ResourceUsage = {
            peakMemoryMB,
            averageMemoryMB: input.averageMemoryMB,
            cpuUtilizationPercent: input.cpuUtilizationPercent,
            eventBufferSize: input.eventBufferSize,
            subscriberCount: input.subscriberCount
          };

          const limits: ResourceLimits = {
            maxMemoryMB: input.baseLimitMB,
            maxCpuPercent: 80,
            maxEventBufferSize: 1000,
            maxSubscriberCount: 50
          };

          const result = validationManager.validateResourceUsage(usage, limits);

          // Property: Memory violations should be detected and reported
          return !result.isValid && 
                 result.errors.some(error => error.code === 'PEAK_MEMORY_EXCEEDED');
        }
      );
    });

    it('should handle edge cases at memory boundaries', () => {
      const boundaryGenerator = fc.record({
        memoryLimitMB: fc.integer({ min: 100, max: 1000 }),
        boundaryOffset: fc.integer({ min: -2, max: 2 }), // Test exactly at, just under, just over
        cpuUtilizationPercent: fc.integer({ min: 0, max: 100 }),
        eventBufferSize: fc.integer({ min: 1, max: 500 }),
        subscriberCount: fc.integer({ min: 1, max: 25 })
      });

      runPerformancePropertyTest(
        boundaryGenerator,
        async (input) => {
          const peakMemoryMB = input.memoryLimitMB + input.boundaryOffset;
          
          const usage: ResourceUsage = {
            peakMemoryMB,
            averageMemoryMB: Math.min(peakMemoryMB - 10, input.memoryLimitMB - 10),
            cpuUtilizationPercent: input.cpuUtilizationPercent,
            eventBufferSize: input.eventBufferSize,
            subscriberCount: input.subscriberCount
          };

          const limits: ResourceLimits = {
            maxMemoryMB: input.memoryLimitMB,
            maxCpuPercent: 80,
            maxEventBufferSize: 1000,
            maxSubscriberCount: 50
          };

          const result = validationManager.validateResourceUsage(usage, limits);

          // Property: Boundary behavior should be consistent
          if (input.boundaryOffset <= 0) {
            // At or under limit should pass
            return result.isValid;
          } else {
            // Over limit should fail with memory error
            return !result.isValid && 
                   result.errors.some(error => error.code === 'PEAK_MEMORY_EXCEEDED');
          }
        }
      );
    });

    it('should validate performance metrics memory constraints', () => {
      const performanceMemoryGenerator = fc.record({
        heapUsedMB: fc.integer({ min: 50, max: 400 }),
        heapTotalMB: fc.integer({ min: 100, max: 500 }),
        externalMB: fc.integer({ min: 1, max: 50 }),
        arrayBuffersMB: fc.integer({ min: 1, max: 50 }),
        taskSnapshotTime: fc.integer({ min: 10, max: 80 }),
        maxMemoryLimitMB: fc.integer({ min: 450, max: 600 })
      });

      runPerformancePropertyTest(
        performanceMemoryGenerator,
        async (input) => {
          const metrics: PerformanceMetrics = {
            taskSnapshotGenerationTime: input.taskSnapshotTime,
            eventDeliveryLatency: [10, 20, 30],
            uiUpdateResponseTime: [5, 15, 25],
            memoryUsage: {
              heapUsed: input.heapUsedMB * 1024 * 1024,
              heapTotal: Math.max(input.heapTotalMB * 1024 * 1024, input.heapUsedMB * 1024 * 1024),
              external: input.externalMB * 1024 * 1024,
              arrayBuffers: input.arrayBuffersMB * 1024 * 1024,
              timestamp: Date.now()
            },
            cpuUsage: {
              user: 1000,
              system: 500,
              timestamp: Date.now()
            }
          };

          const constraints: PerformanceConstraints = {
            maxTaskSnapshotGenerationTimeMs: 100,
            maxEventDeliveryLatencyMs: 50,
            maxUIUpdateResponseTimeMs: 50,
            maxMemoryUsageMB: input.maxMemoryLimitMB
          };

          const result = validationManager.validatePerformanceMetrics(metrics, constraints);

          // Property: Memory usage validation should be consistent
          const totalMemoryMB = (input.heapUsedMB + input.externalMB + input.arrayBuffersMB);
          
          if (totalMemoryMB <= input.maxMemoryLimitMB) {
            // Should pass if within limits
            return !result.errors.some(error => error.code === 'MEMORY_USAGE_EXCEEDED');
          } else {
            // Should fail if over limits
            return result.errors.some(error => error.code === 'MEMORY_USAGE_EXCEEDED');
          }
        }
      );
    });

    it('should enforce strict CPU utilization contract (0..100)', () => {
      const cpuViolationGenerator = fc.record({
        peakMemoryMB: fc.integer({ min: 100, max: 400 }),
        averageMemoryMB: fc.integer({ min: 50, max: 300 }),
        cpuUtilizationPercent: fc.oneof(
          fc.integer({ min: -1000, max: -1 }),
          fc.integer({ min: 101, max: 1000 }),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        ),
        eventBufferSize: fc.integer({ min: 1, max: 500 }),
        subscriberCount: fc.integer({ min: 1, max: 25 })
      });

      runPropertyTest(
        cpuViolationGenerator,
        async (input) => {
          const usage: ResourceUsage = {
            peakMemoryMB: input.peakMemoryMB,
            averageMemoryMB: input.averageMemoryMB,
            cpuUtilizationPercent: input.cpuUtilizationPercent,
            eventBufferSize: input.eventBufferSize,
            subscriberCount: input.subscriberCount
          };

          const limits: ResourceLimits = {
            maxMemoryMB: 512,
            maxCpuPercent: 80,
            maxEventBufferSize: 1000,
            maxSubscriberCount: 50
          };

          const result = validationManager.validateResourceUsage(usage, limits);

          // Property: CPU contract violations should be immediately detected
          // with critical severity (contract violation prohibition)
          return !result.isValid && 
                 result.errors.some(error => 
                   error.code === 'INVALID_CPU_UTILIZATION' && 
                   error.severity === 'critical'
                 );
        }
      );
    });
  });
});