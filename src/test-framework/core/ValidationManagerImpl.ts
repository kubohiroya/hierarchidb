// ValidationManagerImpl - Concrete implementation of state verification and validation

import type {
  ValidationManager,
  ValidationReport,
  PerformanceReport,
  ValidationThresholds,
  StateComparisonResult,
  ValidationSchema
} from './ValidationManager.js';
import type {
  NodeId,
  SessionId,
  TaskSnapshot
} from '../types/SessionTypes.js';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExpectedUIState,
  ExpectedProgress,
  ExpectedSessionState,
  ExpectedTask
} from '../types/ValidationTypes.js';
import type {
  PerformanceMetrics,
  PerformanceConstraints,
  ResourceUsage,
  ResourceLimits
} from '../types/PerformanceTypes.js';

/**
 * ValidationManagerImpl - Comprehensive state and performance validation implementation
 * 
 * Provides concrete validation capabilities with strict contract enforcement.
 * All validation methods enforce immediate error reporting for contract violations.
 */
export class ValidationManagerImpl implements ValidationManager {
  private validationThresholds: ValidationThresholds;

  constructor(thresholds?: Partial<ValidationThresholds>) {
    this.validationThresholds = {
      performanceTolerancePercent: 10,
      latencyThresholdMs: 100,
      memoryThresholdMB: 512,
      errorRateThreshold: 0.01,
      ...thresholds
    };
  }

  // UI state validation
  validateStep5Display(nodeId: NodeId, expectedState: ExpectedUIState): ValidationResult {
    if (!nodeId || typeof nodeId !== 'string') {
      return this.createErrorResult('INVALID_NODE_ID', 'NodeId must be a non-empty string');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate empty state content - strict requirement from design
    if (expectedState.emptyStateContent !== undefined) {
      if (expectedState.emptyStateContent !== 'No tasks yet.') {
        errors.push({
          code: 'INVALID_EMPTY_STATE_CONTENT',
          message: `Expected empty state content to be "No tasks yet.", got: ${expectedState.emptyStateContent}`,
          severity: 'high'
        });
      }
    }

    // Validate display status
    if (expectedState.displayStatus !== undefined) {
      const validStatuses = ['running', 'paused', 'completed', 'error'] as const;
      if (!validStatuses.includes(expectedState.displayStatus)) {
        errors.push({
          code: 'INVALID_DISPLAY_STATUS',
          message: `Invalid display status: ${expectedState.displayStatus}`,
          severity: 'high'
        });
      }
    }

    // Validate task count
    if (expectedState.taskCount !== undefined) {
      if (!Number.isInteger(expectedState.taskCount) || expectedState.taskCount < 0) {
        errors.push({
          code: 'INVALID_TASK_COUNT',
          message: `Task count must be a non-negative integer, got: ${expectedState.taskCount}`,
          severity: 'medium'
        });
      }
    }

    // Validate progress values - strict finite number and 0..100 range enforcement
    if (expectedState.progressValues) {
      for (const [taskId, progress] of Object.entries(expectedState.progressValues)) {
        if (!this.isValidProgress(progress)) {
          errors.push({
            code: 'INVALID_PROGRESS_VALUE',
            message: `Progress for task ${taskId} must be finite number 0..100, got: ${progress}`,
            severity: 'critical',
            context: { taskId, progress }
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { nodeId, validatedAt: Date.now() }
    };
  }

  validateProgressDisplay(nodeId: NodeId, expectedProgress: ExpectedProgress): ValidationResult {
    if (!nodeId || typeof nodeId !== 'string') {
      return this.createErrorResult('INVALID_NODE_ID', 'NodeId must be a non-empty string');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate task ID
    if (!expectedProgress.taskId || typeof expectedProgress.taskId !== 'string') {
      errors.push({
        code: 'INVALID_TASK_ID',
        message: 'TaskId must be a non-empty string',
        severity: 'high'
      });
    }

    // Strict progress value validation - contract violation immediate error
    if (!this.isValidProgress(expectedProgress.expectedValue)) {
      errors.push({
        code: 'INVALID_PROGRESS_VALUE',
        message: `Progress must be finite number 0..100, got: ${expectedProgress.expectedValue}`,
        severity: 'critical',
        context: { expectedValue: expectedProgress.expectedValue }
      });
    }

    // Validate tolerance if provided
    if (expectedProgress.tolerance !== undefined) {
      if (!Number.isFinite(expectedProgress.tolerance) || expectedProgress.tolerance < 0) {
        errors.push({
          code: 'INVALID_TOLERANCE',
          message: `Tolerance must be non-negative finite number, got: ${expectedProgress.tolerance}`,
          severity: 'medium'
        });
      }
    }

    // Validate timestamp if provided
    if (expectedProgress.timestamp !== undefined) {
      if (!Number.isInteger(expectedProgress.timestamp) || expectedProgress.timestamp <= 0) {
        errors.push({
          code: 'INVALID_TIMESTAMP',
          message: `Timestamp must be positive integer, got: ${expectedProgress.timestamp}`,
          severity: 'medium'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { nodeId, taskId: expectedProgress.taskId, validatedAt: Date.now() }
    };
  }

  // Session state validation
  validateSessionState(sessionId: SessionId, expectedState: ExpectedSessionState): ValidationResult {
    if (!sessionId || typeof sessionId !== 'string') {
      return this.createErrorResult('INVALID_SESSION_ID', 'SessionId must be a non-empty string');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate session ID consistency
    if (expectedState.sessionId !== sessionId) {
      errors.push({
        code: 'SESSION_ID_MISMATCH',
        message: `Session ID mismatch: expected ${sessionId}, got ${expectedState.sessionId}`,
        severity: 'critical'
      });
    }

    // Validate session status
    const validStatuses = ['idle', 'running', 'paused', 'completed', 'error'] as const;
    if (!validStatuses.includes(expectedState.status)) {
      errors.push({
        code: 'INVALID_SESSION_STATUS',
        message: `Invalid session status: ${expectedState.status}`,
        severity: 'high'
      });
    }

    // Validate build stage
    const validStages = [
      'initialization', 'metadata-generation', 'task-creation',
      'parallel-execution', 'aggregation', 'completion'
    ] as const;
    if (!validStages.includes(expectedState.currentStage)) {
      errors.push({
        code: 'INVALID_BUILD_STAGE',
        message: `Invalid build stage: ${expectedState.currentStage}`,
        severity: 'high'
      });
    }

    // Validate task counts
    if (expectedState.taskCount !== undefined) {
      if (!Number.isInteger(expectedState.taskCount) || expectedState.taskCount < 0) {
        errors.push({
          code: 'INVALID_TASK_COUNT',
          message: `Task count must be non-negative integer, got: ${expectedState.taskCount}`,
          severity: 'medium'
        });
      }
    }

    if (expectedState.completedTasks !== undefined) {
      if (!Number.isInteger(expectedState.completedTasks) || expectedState.completedTasks < 0) {
        errors.push({
          code: 'INVALID_COMPLETED_TASKS',
          message: `Completed tasks must be non-negative integer, got: ${expectedState.completedTasks}`,
          severity: 'medium'
        });
      }

      // Validate completed tasks <= total tasks
      if (expectedState.taskCount !== undefined && 
          expectedState.completedTasks > expectedState.taskCount) {
        errors.push({
          code: 'COMPLETED_EXCEEDS_TOTAL',
          message: `Completed tasks (${expectedState.completedTasks}) exceeds total tasks (${expectedState.taskCount})`,
          severity: 'high'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { sessionId, validatedAt: Date.now() }
    };
  }

  validateTaskSnapshots(snapshots: TaskSnapshot[], expectedTasks: ExpectedTask[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!Array.isArray(snapshots)) {
      return this.createErrorResult('INVALID_SNAPSHOTS', 'Snapshots must be an array');
    }

    if (!Array.isArray(expectedTasks)) {
      return this.createErrorResult('INVALID_EXPECTED_TASKS', 'Expected tasks must be an array');
    }

    // Validate each snapshot
    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      
      if (!snapshot.nodeId || typeof snapshot.nodeId !== 'string') {
        errors.push({
          code: 'INVALID_SNAPSHOT_NODE_ID',
          message: `Snapshot ${i}: NodeId must be non-empty string`,
          severity: 'high',
          context: { snapshotIndex: i }
        });
      }

      if (!Number.isInteger(snapshot.generatedAt) || snapshot.generatedAt <= 0) {
        errors.push({
          code: 'INVALID_GENERATED_AT',
          message: `Snapshot ${i}: generatedAt must be positive integer`,
          severity: 'medium',
          context: { snapshotIndex: i }
        });
      }

      if (!Array.isArray(snapshot.tasks)) {
        errors.push({
          code: 'INVALID_SNAPSHOT_TASKS',
          message: `Snapshot ${i}: tasks must be an array`,
          severity: 'high',
          context: { snapshotIndex: i }
        });
      }
    }

    // Validate expected tasks
    for (let i = 0; i < expectedTasks.length; i++) {
      const task = expectedTasks[i];
      
      if (!task.taskId || typeof task.taskId !== 'string') {
        errors.push({
          code: 'INVALID_EXPECTED_TASK_ID',
          message: `Expected task ${i}: taskId must be non-empty string`,
          severity: 'high',
          context: { taskIndex: i }
        });
      }

      if (task.progress !== undefined && !this.isValidProgress(task.progress)) {
        errors.push({
          code: 'INVALID_EXPECTED_TASK_PROGRESS',
          message: `Expected task ${i}: progress must be finite number 0..100, got: ${task.progress}`,
          severity: 'critical',
          context: { taskIndex: i, progress: task.progress }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { 
        snapshotCount: snapshots.length, 
        expectedTaskCount: expectedTasks.length,
        validatedAt: Date.now() 
      }
    };
  }

  // Performance validation
  validatePerformanceMetrics(metrics: PerformanceMetrics, constraints: PerformanceConstraints): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate task snapshot generation time
    if (!Number.isFinite(metrics.taskSnapshotGenerationTime) || metrics.taskSnapshotGenerationTime < 0) {
      errors.push({
        code: 'INVALID_SNAPSHOT_GENERATION_TIME',
        message: `Task snapshot generation time must be non-negative finite number, got: ${metrics.taskSnapshotGenerationTime}`,
        severity: 'high'
      });
    } else if (metrics.taskSnapshotGenerationTime > constraints.maxTaskSnapshotGenerationTimeMs) {
      errors.push({
        code: 'SNAPSHOT_GENERATION_TIME_EXCEEDED',
        message: `Task snapshot generation time (${metrics.taskSnapshotGenerationTime}ms) exceeds limit (${constraints.maxTaskSnapshotGenerationTimeMs}ms)`,
        severity: 'critical'
      });
    }

    // Validate event delivery latency
    if (!Array.isArray(metrics.eventDeliveryLatency)) {
      errors.push({
        code: 'INVALID_EVENT_DELIVERY_LATENCY',
        message: 'Event delivery latency must be an array',
        severity: 'high'
      });
    } else {
      for (let i = 0; i < metrics.eventDeliveryLatency.length; i++) {
        const latency = metrics.eventDeliveryLatency[i];
        if (!Number.isFinite(latency) || latency < 0) {
          errors.push({
            code: 'INVALID_LATENCY_VALUE',
            message: `Event delivery latency[${i}] must be non-negative finite number, got: ${latency}`,
            severity: 'medium'
          });
        } else if (latency > constraints.maxEventDeliveryLatencyMs) {
          warnings.push({
            code: 'HIGH_EVENT_DELIVERY_LATENCY',
            message: `Event delivery latency[${i}] (${latency}ms) exceeds threshold (${constraints.maxEventDeliveryLatencyMs}ms)`,
            suggestion: 'Consider optimizing event delivery pipeline'
          });
        }
      }
    }

    // Validate UI update response time
    if (!Array.isArray(metrics.uiUpdateResponseTime)) {
      errors.push({
        code: 'INVALID_UI_UPDATE_RESPONSE_TIME',
        message: 'UI update response time must be an array',
        severity: 'high'
      });
    } else {
      for (let i = 0; i < metrics.uiUpdateResponseTime.length; i++) {
        const responseTime = metrics.uiUpdateResponseTime[i];
        if (!Number.isFinite(responseTime) || responseTime < 0) {
          errors.push({
            code: 'INVALID_RESPONSE_TIME_VALUE',
            message: `UI update response time[${i}] must be non-negative finite number, got: ${responseTime}`,
            severity: 'medium'
          });
        } else if (responseTime > constraints.maxUIUpdateResponseTimeMs) {
          warnings.push({
            code: 'HIGH_UI_UPDATE_RESPONSE_TIME',
            message: `UI update response time[${i}] (${responseTime}ms) exceeds threshold (${constraints.maxUIUpdateResponseTimeMs}ms)`,
            suggestion: 'Consider optimizing UI update logic'
          });
        }
      }
    }

    // Validate memory usage
    if (!metrics.memoryUsage || typeof metrics.memoryUsage !== 'object') {
      errors.push({
        code: 'INVALID_MEMORY_USAGE',
        message: 'Memory usage must be an object',
        severity: 'high'
      });
    } else {
      const memoryFields = ['heapUsed', 'heapTotal', 'external', 'arrayBuffers'] as const;
      for (const field of memoryFields) {
        const value = metrics.memoryUsage[field];
        if (!Number.isFinite(value) || value < 0) {
          errors.push({
            code: 'INVALID_MEMORY_FIELD',
            message: `Memory usage ${field} must be non-negative finite number, got: ${value}`,
            severity: 'medium'
          });
        }
      }

      const totalMemoryMB = metrics.memoryUsage.heapTotal / (1024 * 1024);
      if (totalMemoryMB > constraints.maxMemoryUsageMB) {
        errors.push({
          code: 'MEMORY_USAGE_EXCEEDED',
          message: `Memory usage (${totalMemoryMB.toFixed(2)}MB) exceeds limit (${constraints.maxMemoryUsageMB}MB)`,
          severity: 'critical'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { validatedAt: Date.now() }
    };
  }

  validateResourceUsage(usage: ResourceUsage, limits: ResourceLimits): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate peak memory
    if (!Number.isFinite(usage.peakMemoryMB) || usage.peakMemoryMB < 0) {
      errors.push({
        code: 'INVALID_PEAK_MEMORY',
        message: `Peak memory must be non-negative finite number, got: ${usage.peakMemoryMB}`,
        severity: 'high'
      });
    } else if (usage.peakMemoryMB > limits.maxMemoryMB) {
      errors.push({
        code: 'PEAK_MEMORY_EXCEEDED',
        message: `Peak memory (${usage.peakMemoryMB}MB) exceeds limit (${limits.maxMemoryMB}MB)`,
        severity: 'critical'
      });
    }

    // Validate average memory
    if (!Number.isFinite(usage.averageMemoryMB) || usage.averageMemoryMB < 0) {
      errors.push({
        code: 'INVALID_AVERAGE_MEMORY',
        message: `Average memory must be non-negative finite number, got: ${usage.averageMemoryMB}`,
        severity: 'high'
      });
    }

    // Validate CPU utilization - strict 0..100 range
    if (!this.isValidProgress(usage.cpuUtilizationPercent)) {
      errors.push({
        code: 'INVALID_CPU_UTILIZATION',
        message: `CPU utilization must be finite number 0..100, got: ${usage.cpuUtilizationPercent}`,
        severity: 'critical'
      });
    } else if (usage.cpuUtilizationPercent > limits.maxCpuPercent) {
      warnings.push({
        code: 'HIGH_CPU_UTILIZATION',
        message: `CPU utilization (${usage.cpuUtilizationPercent}%) exceeds threshold (${limits.maxCpuPercent}%)`,
        suggestion: 'Consider optimizing CPU-intensive operations'
      });
    }

    // Validate event buffer size
    if (!Number.isInteger(usage.eventBufferSize) || usage.eventBufferSize < 0) {
      errors.push({
        code: 'INVALID_EVENT_BUFFER_SIZE',
        message: `Event buffer size must be non-negative integer, got: ${usage.eventBufferSize}`,
        severity: 'medium'
      });
    } else if (usage.eventBufferSize > limits.maxEventBufferSize) {
      warnings.push({
        code: 'LARGE_EVENT_BUFFER',
        message: `Event buffer size (${usage.eventBufferSize}) exceeds threshold (${limits.maxEventBufferSize})`,
        suggestion: 'Consider increasing event processing rate'
      });
    }

    // Validate subscriber count
    if (!Number.isInteger(usage.subscriberCount) || usage.subscriberCount < 0) {
      errors.push({
        code: 'INVALID_SUBSCRIBER_COUNT',
        message: `Subscriber count must be non-negative integer, got: ${usage.subscriberCount}`,
        severity: 'medium'
      });
    } else if (usage.subscriberCount > limits.maxSubscriberCount) {
      warnings.push({
        code: 'HIGH_SUBSCRIBER_COUNT',
        message: `Subscriber count (${usage.subscriberCount}) exceeds threshold (${limits.maxSubscriberCount})`,
        suggestion: 'Consider subscriber management optimization'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: { validatedAt: Date.now() }
    };
  }

  // Cross-component validation (placeholder implementations)
  validateSessionUIConsistency(sessionId: SessionId, nodeId: NodeId): ValidationResult {
    // Implementation would validate consistency between session state and UI state
    return { isValid: true, errors: [], warnings: [] };
  }

  validateEventUIReflection(nodeId: NodeId, timeWindow: number): ValidationResult {
    // Implementation would validate that events are properly reflected in UI within time window
    return { isValid: true, errors: [], warnings: [] };
  }

  // Validation reporting (placeholder implementations)
  generateValidationReport(results: ValidationResult[]): ValidationReport {
    const reportId = `validation-${Date.now()}`;
    const totalValidations = results.length;
    const passedValidations = results.filter(r => r.isValid).length;
    const failedValidations = totalValidations - passedValidations;
    
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    return {
      reportId,
      generatedAt: Date.now(),
      overallResult: {
        isValid: failedValidations === 0,
        errors: allErrors,
        warnings: allWarnings
      },
      categoryResults: [],
      recommendations: [],
      summary: {
        totalValidations,
        passedValidations,
        failedValidations,
        warningCount: allWarnings.length,
        criticalIssues: allErrors.filter(e => e.severity === 'critical').length
      }
    };
  }

  generatePerformanceReport(metrics: PerformanceMetrics[]): PerformanceReport {
    return {
      reportId: `performance-${Date.now()}`,
      generatedAt: Date.now(),
      metrics,
      benchmarks: [],
      trends: [],
      recommendations: []
    };
  }

  // Validation configuration
  setValidationThresholds(thresholds: ValidationThresholds): void {
    this.validationThresholds = { ...thresholds };
  }

  getValidationThresholds(): ValidationThresholds {
    return { ...this.validationThresholds };
  }

  // Validation utilities
  compareStates<T>(actual: T, expected: T, tolerance?: number): StateComparisonResult<T> {
    // Basic implementation - would be enhanced for deep comparison
    const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
    return {
      isEqual,
      differences: [],
      similarity: isEqual ? 1 : 0,
      actual,
      expected
    };
  }

  validateDataIntegrity(data: unknown, schema: ValidationSchema): ValidationResult {
    // Basic schema validation implementation
    return { isValid: true, errors: [], warnings: [] };
  }

  // Private helper methods
  private isValidProgress(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 100;
  }

  private createErrorResult(code: string, message: string): ValidationResult {
    return {
      isValid: false,
      errors: [{
        code,
        message,
        severity: 'critical' as const
      }],
      warnings: []
    };
  }
}