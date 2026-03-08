// ValidationManagerImpl unit tests

import { ValidationManagerImpl } from '../ValidationManagerImpl.js';
import type {
  ExpectedUIState,
  ExpectedProgress,
  ExpectedSessionState,
  ExpectedTask
} from '../../types/ValidationTypes.js';
import type {
  TaskSnapshot,
  BuildStage
} from '../../types/SessionTypes.js';
import type {
  PerformanceMetrics,
  PerformanceConstraints,
  ResourceUsage,
  ResourceLimits
} from '../../types/PerformanceTypes.js';

describe('ValidationManagerImpl', () => {
  let validationManager: ValidationManagerImpl;

  beforeEach(() => {
    validationManager = new ValidationManagerImpl();
  });

  describe('validateStep5Display', () => {
    it('should validate empty state content correctly', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = {
        emptyStateContent: 'No tasks yet.'
      };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid empty state content', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = {
        emptyStateContent: 'Invalid content'
      };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_EMPTY_STATE_CONTENT');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should reject invalid nodeId', () => {
      const result = validationManager.validateStep5Display('', {});

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_NODE_ID');
    });

    it('should validate display status correctly', () => {
      const nodeId = 'test-node-1';
      const validStatuses = ['running', 'paused', 'completed', 'error'] as const;

      for (const status of validStatuses) {
        const expectedState: ExpectedUIState = { displayStatus: status };
        const result = validationManager.validateStep5Display(nodeId, expectedState);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid display status', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = {
        displayStatus: 'invalid' as any
      };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_DISPLAY_STATUS');
    });

    it('should validate task count correctly', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = { taskCount: 5 };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(true);
    });

    it('should reject negative task count', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = { taskCount: -1 };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TASK_COUNT');
    });

    it('should validate progress values with strict 0..100 range', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = {
        progressValues: {
          'task1': 0,
          'task2': 50,
          'task3': 100
        }
      };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(true);
    });

    it('should reject progress values outside 0..100 range', () => {
      const nodeId = 'test-node-1';
      const expectedState: ExpectedUIState = {
        progressValues: {
          'task1': -1,
          'task2': 101,
          'task3': NaN,
          'task4': Infinity
        }
      };

      const result = validationManager.validateStep5Display(nodeId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      result.errors.forEach(error => {
        expect(error.code).toBe('INVALID_PROGRESS_VALUE');
        expect(error.severity).toBe('critical');
      });
    });
  });

  describe('validateProgressDisplay', () => {
    it('should validate valid progress display', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 75
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid nodeId', () => {
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 50
      };

      const result = validationManager.validateProgressDisplay('', expectedProgress);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_NODE_ID');
    });

    it('should reject invalid taskId', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: '',
        expectedValue: 50
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TASK_ID');
    });

    it('should enforce strict progress value validation', () => {
      const nodeId = 'test-node-1';
      const invalidValues = [-1, 101, NaN, Infinity, -Infinity];

      for (const value of invalidValues) {
        const expectedProgress: ExpectedProgress = {
          taskId: 'task-1',
          expectedValue: value
        };

        const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

        expect(result.isValid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_PROGRESS_VALUE');
        expect(result.errors[0].severity).toBe('critical');
      }
    });

    it('should validate tolerance correctly', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 50,
        tolerance: 5
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(true);
    });

    it('should reject negative tolerance', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 50,
        tolerance: -1
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TOLERANCE');
    });

    it('should validate timestamp correctly', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 50,
        timestamp: Date.now()
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid timestamp', () => {
      const nodeId = 'test-node-1';
      const expectedProgress: ExpectedProgress = {
        taskId: 'task-1',
        expectedValue: 50,
        timestamp: -1
      };

      const result = validationManager.validateProgressDisplay(nodeId, expectedProgress);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TIMESTAMP');
    });
  });

  describe('validateSessionState', () => {
    it('should validate valid session state', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId: 'session-1',
        status: 'running',
        currentStage: 'parallel-execution',
        taskCount: 10,
        completedTasks: 5
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid sessionId', () => {
      const expectedState: ExpectedSessionState = {
        sessionId: 'session-1',
        status: 'running',
        currentStage: 'parallel-execution'
      };

      const result = validationManager.validateSessionState('', expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SESSION_ID');
    });

    it('should detect session ID mismatch', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId: 'session-2',
        status: 'running',
        currentStage: 'parallel-execution'
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('SESSION_ID_MISMATCH');
      expect(result.errors[0].severity).toBe('critical');
    });

    it('should validate all session statuses', () => {
      const sessionId = 'session-1';
      const validStatuses = ['idle', 'running', 'paused', 'completed', 'error'] as const;

      for (const status of validStatuses) {
        const expectedState: ExpectedSessionState = {
          sessionId,
          status,
          currentStage: 'parallel-execution'
        };

        const result = validationManager.validateSessionState(sessionId, expectedState);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid session status', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId,
        status: 'invalid' as any,
        currentStage: 'parallel-execution'
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SESSION_STATUS');
    });

    it('should validate all build stages', () => {
      const sessionId = 'session-1';
      const validStages: BuildStage[] = [
        'initialization', 'metadata-generation', 'task-creation',
        'parallel-execution', 'aggregation', 'completion'
      ];

      for (const stage of validStages) {
        const expectedState: ExpectedSessionState = {
          sessionId,
          status: 'running',
          currentStage: stage
        };

        const result = validationManager.validateSessionState(sessionId, expectedState);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid build stage', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId,
        status: 'running',
        currentStage: 'invalid' as any
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_BUILD_STAGE');
    });

    it('should validate task counts correctly', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId,
        status: 'running',
        currentStage: 'parallel-execution',
        taskCount: 10,
        completedTasks: 5
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(true);
    });

    it('should reject negative task counts', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId,
        status: 'running',
        currentStage: 'parallel-execution',
        taskCount: -1,
        completedTasks: -1
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe('INVALID_TASK_COUNT');
      expect(result.errors[1].code).toBe('INVALID_COMPLETED_TASKS');
    });

    it('should detect when completed tasks exceed total tasks', () => {
      const sessionId = 'session-1';
      const expectedState: ExpectedSessionState = {
        sessionId,
        status: 'running',
        currentStage: 'parallel-execution',
        taskCount: 5,
        completedTasks: 10
      };

      const result = validationManager.validateSessionState(sessionId, expectedState);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('COMPLETED_EXCEEDS_TOTAL');
      expect(result.errors[0].severity).toBe('high');
    });
  });

  describe('validateTaskSnapshots', () => {
    it('should validate valid task snapshots', () => {
      const snapshots: TaskSnapshot[] = [{
        nodeId: 'node-1',
        stage: 'task-creation',
        tasks: [{
          taskId: 'task-1',
          name: 'Test Task',
          stage: 'task-creation'
        }],
        generatedAt: Date.now(),
        metadata: {
          nodeId: 'node-1',
          buildType: 'new',
          stages: ['task-creation']
        }
      }];

      const expectedTasks: ExpectedTask[] = [{
        taskId: 'task-1',
        name: 'Test Task',
        stage: 'task-creation',
        status: 'pending',
        progress: 0
      }];

      const result = validationManager.validateTaskSnapshots(snapshots, expectedTasks);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array snapshots', () => {
      const result = validationManager.validateTaskSnapshots(null as any, []);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SNAPSHOTS');
    });

    it('should reject non-array expected tasks', () => {
      const result = validationManager.validateTaskSnapshots([], null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EXPECTED_TASKS');
    });

    it('should validate snapshot nodeId', () => {
      const snapshots: TaskSnapshot[] = [{
        nodeId: '',
        stage: 'task-creation',
        tasks: [],
        generatedAt: Date.now(),
        metadata: {
          nodeId: '',
          buildType: 'new',
          stages: ['task-creation']
        }
      }];

      const result = validationManager.validateTaskSnapshots(snapshots, []);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SNAPSHOT_NODE_ID');
    });

    it('should validate generatedAt timestamp', () => {
      const snapshots: TaskSnapshot[] = [{
        nodeId: 'node-1',
        stage: 'task-creation',
        tasks: [],
        generatedAt: -1,
        metadata: {
          nodeId: 'node-1',
          buildType: 'new',
          stages: ['task-creation']
        }
      }];

      const result = validationManager.validateTaskSnapshots(snapshots, []);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_GENERATED_AT');
    });

    it('should validate expected task progress with strict range', () => {
      const expectedTasks: ExpectedTask[] = [{
        taskId: 'task-1',
        name: 'Test Task',
        stage: 'task-creation',
        status: 'pending',
        progress: 150 // Invalid progress
      }];

      const result = validationManager.validateTaskSnapshots([], expectedTasks);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EXPECTED_TASK_PROGRESS');
      expect(result.errors[0].severity).toBe('critical');
    });
  });

  describe('validatePerformanceMetrics', () => {
    it('should validate valid performance metrics', () => {
      const metrics: PerformanceMetrics = {
        taskSnapshotGenerationTime: 50,
        eventDeliveryLatency: [10, 20, 30],
        uiUpdateResponseTime: [5, 15, 25],
        memoryUsage: {
          heapUsed: 1024 * 1024 * 100, // 100MB
          heapTotal: 1024 * 1024 * 200, // 200MB
          external: 1024 * 1024 * 10, // 10MB
          arrayBuffers: 1024 * 1024 * 5, // 5MB
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
        maxMemoryUsageMB: 512
      };

      const result = validationManager.validatePerformanceMetrics(metrics, constraints);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid task snapshot generation time', () => {
      const metrics: PerformanceMetrics = {
        taskSnapshotGenerationTime: -1,
        eventDeliveryLatency: [],
        uiUpdateResponseTime: [],
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          arrayBuffers: 0,
          timestamp: Date.now()
        },
        cpuUsage: {
          user: 0,
          system: 0,
          timestamp: Date.now()
        }
      };

      const constraints: PerformanceConstraints = {
        maxTaskSnapshotGenerationTimeMs: 100,
        maxEventDeliveryLatencyMs: 50,
        maxUIUpdateResponseTimeMs: 50,
        maxMemoryUsageMB: 512
      };

      const result = validationManager.validatePerformanceMetrics(metrics, constraints);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SNAPSHOT_GENERATION_TIME');
    });

    it('should detect performance constraint violations', () => {
      const metrics: PerformanceMetrics = {
        taskSnapshotGenerationTime: 200, // Exceeds limit
        eventDeliveryLatency: [100], // Exceeds limit
        uiUpdateResponseTime: [100], // Exceeds limit
        memoryUsage: {
          heapUsed: 1024 * 1024 * 600, // 600MB - exceeds limit
          heapTotal: 1024 * 1024 * 600,
          external: 0,
          arrayBuffers: 0,
          timestamp: Date.now()
        },
        cpuUsage: {
          user: 0,
          system: 0,
          timestamp: Date.now()
        }
      };

      const constraints: PerformanceConstraints = {
        maxTaskSnapshotGenerationTimeMs: 100,
        maxEventDeliveryLatencyMs: 50,
        maxUIUpdateResponseTimeMs: 50,
        maxMemoryUsageMB: 512
      };

      const result = validationManager.validatePerformanceMetrics(metrics, constraints);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'SNAPSHOT_GENERATION_TIME_EXCEEDED')).toBe(true);
      expect(result.errors.some(e => e.code === 'MEMORY_USAGE_EXCEEDED')).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_EVENT_DELIVERY_LATENCY')).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_UI_UPDATE_RESPONSE_TIME')).toBe(true);
    });
  });

  describe('validateResourceUsage', () => {
    it('should validate valid resource usage', () => {
      const usage: ResourceUsage = {
        peakMemoryMB: 256,
        averageMemoryMB: 128,
        cpuUtilizationPercent: 50,
        eventBufferSize: 100,
        subscriberCount: 10
      };

      const limits: ResourceLimits = {
        maxMemoryMB: 512,
        maxCpuPercent: 80,
        maxEventBufferSize: 1000,
        maxSubscriberCount: 50
      };

      const result = validationManager.validateResourceUsage(usage, limits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should enforce strict CPU utilization range (0..100)', () => {
      const invalidCpuValues = [-1, 101, NaN, Infinity];

      for (const cpuValue of invalidCpuValues) {
        const usage: ResourceUsage = {
          peakMemoryMB: 256,
          averageMemoryMB: 128,
          cpuUtilizationPercent: cpuValue,
          eventBufferSize: 100,
          subscriberCount: 10
        };

        const limits: ResourceLimits = {
          maxMemoryMB: 512,
          maxCpuPercent: 80,
          maxEventBufferSize: 1000,
          maxSubscriberCount: 50
        };

        const result = validationManager.validateResourceUsage(usage, limits);

        expect(result.isValid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_CPU_UTILIZATION');
        expect(result.errors[0].severity).toBe('critical');
      }
    });

    it('should detect resource limit violations', () => {
      const usage: ResourceUsage = {
        peakMemoryMB: 600, // Exceeds limit
        averageMemoryMB: 128,
        cpuUtilizationPercent: 90, // Exceeds threshold
        eventBufferSize: 1500, // Exceeds threshold
        subscriberCount: 60 // Exceeds threshold
      };

      const limits: ResourceLimits = {
        maxMemoryMB: 512,
        maxCpuPercent: 80,
        maxEventBufferSize: 1000,
        maxSubscriberCount: 50
      };

      const result = validationManager.validateResourceUsage(usage, limits);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PEAK_MEMORY_EXCEEDED')).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_CPU_UTILIZATION')).toBe(true);
      expect(result.warnings.some(w => w.code === 'LARGE_EVENT_BUFFER')).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_SUBSCRIBER_COUNT')).toBe(true);
    });
  });

  describe('validation thresholds', () => {
    it('should set and get validation thresholds', () => {
      const thresholds = {
        performanceTolerancePercent: 15,
        latencyThresholdMs: 200,
        memoryThresholdMB: 1024,
        errorRateThreshold: 0.05
      };

      validationManager.setValidationThresholds(thresholds);
      const retrieved = validationManager.getValidationThresholds();

      expect(retrieved).toEqual(thresholds);
    });

    it('should use default thresholds when not specified', () => {
      const thresholds = validationManager.getValidationThresholds();

      expect(thresholds.performanceTolerancePercent).toBe(10);
      expect(thresholds.latencyThresholdMs).toBe(100);
      expect(thresholds.memoryThresholdMB).toBe(512);
      expect(thresholds.errorRateThreshold).toBe(0.01);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate comprehensive validation report', () => {
      const results = [
        { isValid: true, errors: [], warnings: [] },
        { isValid: false, errors: [{ code: 'TEST_ERROR', message: 'Test error', severity: 'high' as const }], warnings: [] },
        { isValid: true, errors: [], warnings: [{ code: 'TEST_WARNING', message: 'Test warning' }] }
      ];

      const report = validationManager.generateValidationReport(results);

      expect(report.reportId).toMatch(/^validation-\d+$/);
      expect(report.summary.totalValidations).toBe(3);
      expect(report.summary.passedValidations).toBe(2);
      expect(report.summary.failedValidations).toBe(1);
      expect(report.summary.warningCount).toBe(1);
      expect(report.overallResult.isValid).toBe(false);
    });
  });
});