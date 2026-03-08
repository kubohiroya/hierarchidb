// TestManagerImpl unit tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestManagerImpl } from '../TestManagerImpl.js';
import type { SessionController } from '../SessionController.js';
import type { EventCapture } from '../EventCapture.js';
import type { ValidationManager } from '../ValidationManager.js';
import type {
  Step5TestScenario,
  LifecycleTestScenario,
  EventStreamTestScenario,
  StateSyncTestScenario,
  BufferingTestScenario,
  ErrorHandlingTestScenario,
  PerformanceTestScenario
} from '../../types/ScenarioTypes.js';

describe('TestManagerImpl', () => {
  let testManager: TestManagerImpl;
  let mockSessionController: SessionController;
  let mockEventCapture: EventCapture;
  let mockValidationManager: ValidationManager;

  beforeEach(() => {
    // Create mock implementations
    mockSessionController = {
      createNewSession: vi.fn(),
      resetSession: vi.fn(),
      clearCache: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      cancelSession: vi.fn(),
      getSessionState: vi.fn(),
      waitForSessionCompletion: vi.fn(),
      listActiveSessions: vi.fn(),
      getSessionHistory: vi.fn(),
      validateSessionState: vi.fn(),
      cleanupCompletedSessions: vi.fn(),
      forceCleanupSession: vi.fn()
    } as SessionController;

    mockEventCapture = {
      captureEventStream: vi.fn(),
      stopCapture: vi.fn(),
      validateEventSequence: vi.fn(),
      validateEventTiming: vi.fn(),
      verifySequenceNumbers: vi.fn(),
      detectEventLoss: vi.fn(),
      filterEventsByType: vi.fn(),
      analyzeEventLatency: vi.fn(),
      listActiveCaptures: vi.fn(),
      pauseCapture: vi.fn(),
      resumeCapture: vi.fn(),
      replayEvents: vi.fn(),
      simulateEventLoss: vi.fn()
    } as EventCapture;

    mockValidationManager = {
      validateStep5Display: vi.fn(),
      validateProgressDisplay: vi.fn(),
      validateSessionState: vi.fn(),
      validateTaskSnapshots: vi.fn(),
      validatePerformanceMetrics: vi.fn(),
      validateResourceUsage: vi.fn(),
      validateSessionUIConsistency: vi.fn(),
      validateEventUIReflection: vi.fn(),
      generateValidationReport: vi.fn(),
      generatePerformanceReport: vi.fn(),
      setValidationThresholds: vi.fn(),
      getValidationThresholds: vi.fn(),
      compareStates: vi.fn(),
      validateDataIntegrity: vi.fn()
    } as ValidationManager;

    testManager = new TestManagerImpl(
      mockSessionController,
      mockEventCapture,
      mockValidationManager
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if sessionController is not provided', () => {
      expect(() => {
        new TestManagerImpl(null as any, mockEventCapture, mockValidationManager);
      }).toThrow('TestManagerImpl: sessionController is required');
    });

    it('should throw error if eventCapture is not provided', () => {
      expect(() => {
        new TestManagerImpl(mockSessionController, null as any, mockValidationManager);
      }).toThrow('TestManagerImpl: eventCapture is required');
    });

    it('should throw error if validationManager is not provided', () => {
      expect(() => {
        new TestManagerImpl(mockSessionController, mockEventCapture, null as any);
      }).toThrow('TestManagerImpl: validationManager is required');
    });

    it('should initialize with correct default state', () => {
      const progress = testManager.getTestProgress();
      expect(progress.totalTests).toBe(0);
      expect(progress.completedTests).toBe(0);
      expect(progress.runningTests).toBe(0);
      expect(progress.failedTests).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(testManager.initialize()).resolves.not.toThrow();
    });

    it('should throw error if already initialized', async () => {
      await testManager.initialize();
      await expect(testManager.initialize()).rejects.toThrow('TestManagerImpl: already initialized');
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully when initialized', async () => {
      await testManager.initialize();
      await expect(testManager.cleanup()).resolves.not.toThrow();
    });

    it('should not throw when cleaning up uninitialized manager', async () => {
      await expect(testManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('runStep5Tests', () => {
    beforeEach(async () => {
      await testManager.initialize();
    });

    afterEach(async () => {
      await testManager.cleanup();
    });

    it('should validate scenario contract and reject invalid scenarioId', async () => {
      const invalidScenario = {
        scenarioId: '', // Invalid: empty string
        description: 'Test scenario',
        initialSessionState: 'none' as const,
        expectedUIState: { emptyStateContent: 'test' }
      };

      const results = await testManager.runStep5Tests([invalidScenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('scenarioId must be a non-empty string');
    });

    it('should validate scenario contract and reject invalid initialSessionState', async () => {
      const invalidScenario = {
        scenarioId: 'test-1',
        description: 'Test scenario',
        initialSessionState: 'invalid' as any, // Invalid state
        expectedUIState: { emptyStateContent: 'test' }
      };

      const results = await testManager.runStep5Tests([invalidScenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('invalid initialSessionState');
    });

    it('should validate progress event contract and reject invalid progress values', async () => {
      const scenarioWithInvalidProgress = {
        scenarioId: 'test-progress',
        description: 'Test scenario with invalid progress',
        initialSessionState: 'existing' as const,
        expectedUIState: { taskCount: 1 },
        progressEvents: [{
          taskId: 'task-1',
          progress: 150, // Invalid: > 100
          stage: 'initialization' as const,
          timestamp: Date.now()
        }]
      };

      // Mock session creation
      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node',
        createdAt: Date.now()
      });

      // Mock validation to pass initially
      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const results = await testManager.runStep5Tests([scenarioWithInvalidProgress]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('Invalid progress value: 150. Must be finite number 0-100');
    });

    it('should execute successful Step5 test with no existing session', async () => {
      const scenario: Step5TestScenario = {
        scenarioId: 'empty-state-test',
        description: 'Test empty state display',
        initialSessionState: 'none',
        expectedUIState: {
          emptyStateContent: 'No active session',
          taskCount: 0
        }
      };

      // Mock validation success
      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const results = await testManager.runStep5Tests([scenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].scenarioId).toBe('empty-state-test');
      expect(results[0].duration).toBeGreaterThan(0);
    });

    it('should execute successful Step5 test with existing session', async () => {
      const scenario: Step5TestScenario = {
        scenarioId: 'existing-session-test',
        description: 'Test existing session display',
        initialSessionState: 'existing',
        expectedUIState: {
          taskCount: 5,
          displayStatus: 'running'
        }
      };

      // Mock session creation
      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node-existing-session-test',
        createdAt: Date.now()
      });

      // Mock validation success
      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const results = await testManager.runStep5Tests([scenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(mockSessionController.createNewSession).toHaveBeenCalledWith(
        'test-node-existing-session-test',
        expect.objectContaining({
          nodeId: 'test-node-existing-session-test',
          buildType: 'new'
        })
      );
    });
  });

  describe('runLifecycleTests', () => {
    beforeEach(async () => {
      await testManager.initialize();
    });

    afterEach(async () => {
      await testManager.cleanup();
    });

    it('should validate scenario contract and reject invalid expectedTaskCount', async () => {
      const invalidScenario = {
        scenarioId: 'test-1',
        description: 'Test scenario',
        sessionType: 'new' as const,
        buildMetadata: {
          nodeId: 'test-node',
          buildType: 'new' as const,
          stages: ['initialization' as const]
        },
        expectedStages: ['initialization' as const],
        expectedTaskCount: -1, // Invalid: negative number
        parallelTasksPerStage: 1
      };

      const results = await testManager.runLifecycleTests([invalidScenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('expectedTaskCount must be finite number >= 0');
    });

    it('should execute successful lifecycle test', async () => {
      const scenario: LifecycleTestScenario = {
        scenarioId: 'lifecycle-test',
        description: 'Test complete lifecycle',
        sessionType: 'new',
        buildMetadata: {
          nodeId: 'test-node-lifecycle',
          buildType: 'new',
          stages: ['initialization', 'completion']
        },
        expectedStages: ['initialization', 'completion'],
        expectedTaskCount: 2,
        parallelTasksPerStage: 1
      };

      // Mock session creation and completion
      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node-lifecycle',
        createdAt: Date.now()
      });

      vi.mocked(mockSessionController.waitForSessionCompletion).mockResolvedValue({
        sessionId: 'session-1',
        status: 'completed',
        completedAt: Date.now(),
        duration: 1000,
        taskResults: [
          { taskId: 'task-1', status: 'completed', duration: 500 },
          { taskId: 'task-2', status: 'completed', duration: 500 }
        ]
      });

      vi.mocked(mockSessionController.getSessionState).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node-lifecycle',
        status: 'completed',
        currentStage: 'completion',
        taskProgress: {},
        startTime: Date.now() - 1000,
        lastUpdateTime: Date.now()
      });

      const results = await testManager.runLifecycleTests([scenario]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].metadata?.taskCount).toBe(2);
    });
  });

  describe('runComprehensiveTestSuite', () => {
    beforeEach(async () => {
      await testManager.initialize();
    });

    afterEach(async () => {
      await testManager.cleanup();
    });

    it('should throw error if not initialized', async () => {
      await testManager.cleanup();
      await expect(testManager.runComprehensiveTestSuite()).rejects.toThrow('must be initialized');
    });

    it('should execute comprehensive test suite with default scenarios', async () => {
      // Mock all necessary dependencies for default scenarios
      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node',
        createdAt: Date.now()
      });

      vi.mocked(mockSessionController.waitForSessionCompletion).mockResolvedValue({
        sessionId: 'session-1',
        status: 'completed',
        completedAt: Date.now(),
        duration: 1000,
        taskResults: [
          { taskId: 'task-1', status: 'completed', duration: 500 },
          { taskId: 'task-2', status: 'completed', duration: 500 },
          { taskId: 'task-3', status: 'completed', duration: 500 }
        ]
      });

      vi.mocked(mockSessionController.getSessionState).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node',
        status: 'completed',
        currentStage: 'completion',
        taskProgress: {},
        startTime: Date.now() - 1000,
        lastUpdateTime: Date.now()
      });

      vi.mocked(mockEventCapture.captureEventStream).mockReturnValue({
        captureId: 'capture-1',
        nodeId: 'test-node',
        eventTypes: ['task-progress'],
        startTime: Date.now(),
        isActive: true
      });

      vi.mocked(mockEventCapture.stopCapture).mockReturnValue({
        captureId: 'capture-1',
        events: [],
        captureStartTime: Date.now() - 1000,
        captureEndTime: Date.now(),
        totalEvents: 10
      });

      vi.mocked(mockEventCapture.verifySequenceNumbers).mockReturnValue({
        isValid: true,
        gaps: [],
        duplicates: [],
        outOfOrder: []
      });

      vi.mocked(mockEventCapture.detectEventLoss).mockReturnValue({
        totalExpected: 10,
        totalReceived: 10,
        lossRate: 0,
        missingEvents: []
      });

      vi.mocked(mockEventCapture.analyzeEventLatency).mockReturnValue({
        averageLatency: 50,
        medianLatency: 45,
        maxLatency: 80,
        minLatency: 20,
        percentiles: { 95: 75, 99: 80 },
        outliers: []
      });

      const report = await testManager.runComprehensiveTestSuite();
      
      expect(report.categories).toHaveLength(7);
      expect(report.overallSummary.totalTests).toBeGreaterThan(0);
      expect(report.testSuiteId).toMatch(/^comprehensive-\d+$/);
      expect(report.generatedAt).toBeGreaterThan(0);
    });
  });

  describe('generateTestReport', () => {
    it('should validate contract and reject non-array input', () => {
      expect(() => {
        testManager.generateTestReport(null as any);
      }).toThrow('generateTestReport: results must be an array');
    });

    it('should generate test report with correct summary', () => {
      const results = [
        {
          testId: 'test-1',
          scenarioId: 'scenario-1',
          passed: true,
          duration: 100
        },
        {
          testId: 'test-2',
          scenarioId: 'scenario-2',
          passed: false,
          duration: 200,
          error: new Error('Test failed')
        }
      ];

      const report = testManager.generateTestReport(results);
      
      expect(report.results).toEqual(results);
      expect(report.summary.totalTests).toBe(2);
      expect(report.summary.passedTests).toBe(1);
      expect(report.summary.failedTests).toBe(1);
      expect(report.summary.duration).toBe(300);
      expect(report.testSuiteId).toMatch(/^report-\d+$/);
    });
  });

  describe('contract validation edge cases', () => {
    beforeEach(async () => {
      await testManager.initialize();
    });

    afterEach(async () => {
      await testManager.cleanup();
    });

    it('should reject NaN progress values', async () => {
      const scenario = {
        scenarioId: 'nan-progress-test',
        description: 'Test NaN progress rejection',
        initialSessionState: 'existing' as const,
        expectedUIState: { taskCount: 1 },
        progressEvents: [{
          taskId: 'task-1',
          progress: NaN, // Invalid: NaN
          stage: 'initialization' as const,
          timestamp: Date.now()
        }]
      };

      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node',
        createdAt: Date.now()
      });

      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const results = await testManager.runStep5Tests([scenario]);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('Invalid progress value: NaN');
    });

    it('should reject Infinity progress values', async () => {
      const scenario = {
        scenarioId: 'infinity-progress-test',
        description: 'Test Infinity progress rejection',
        initialSessionState: 'existing' as const,
        expectedUIState: { taskCount: 1 },
        progressEvents: [{
          taskId: 'task-1',
          progress: Infinity, // Invalid: Infinity
          stage: 'initialization' as const,
          timestamp: Date.now()
        }]
      };

      vi.mocked(mockSessionController.createNewSession).mockResolvedValue({
        sessionId: 'session-1',
        nodeId: 'test-node',
        createdAt: Date.now()
      });

      vi.mocked(mockValidationManager.validateStep5Display).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      const results = await testManager.runStep5Tests([scenario]);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('Invalid progress value: Infinity');
    });
  });
});