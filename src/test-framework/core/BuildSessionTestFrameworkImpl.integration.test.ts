// BuildSessionTestFrameworkImpl Integration Test
// Comprehensive integration test for the complete test framework

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuildSessionTestFrameworkImpl } from './BuildSessionTestFrameworkImpl.js';
import { TestCategory, TestStatus } from './BuildSessionTestFramework.js';
import type {
  TestFrameworkConfiguration,
  ComprehensiveTestSuite
} from './BuildSessionTestFramework.js';

describe('BuildSessionTestFrameworkImpl Integration', () => {
  let framework: BuildSessionTestFrameworkImpl;
  let testConfiguration: TestFrameworkConfiguration;

  beforeEach(async () => {
    // Initialize test configuration
    testConfiguration = {
      testExecution: {
        parallelWorkers: 2,
        testTimeoutMs: 30000,
        verboseOutput: false
      },
      sessionManagement: {
        maxConcurrentSessions: 5,
        sessionTimeoutMs: 60000,
        enableStatePersistence: false
      },
      eventMonitoring: {
        captureBufferSize: 1000,
        validationTimeoutMs: 5000,
        enableSequenceValidation: true,
        supportedNotificationTypes: ['session-state', 'task-snapshot', 'heartbeat']
      },
      errorHandling: {
        maxRetryAttempts: 3,
        retryDelayMs: 1000,
        enableAutoRecovery: true,
        criticalErrorThreshold: 5
      },
      performanceMonitoring: {
        monitoringIntervalMs: 1000,
        memoryThresholdMB: 512,
        maxAcceptableLatencyMs: 200,
        enableCpuMonitoring: true
      },
      scalabilityTesting: {
        maxConcurrentSessions: 10,
        maxSubscribers: 100,
        isolationThreshold: 0.8,
        enableDetailedMonitoring: true
      },
      integration: {
        streamingBufferSize: 2000
      }
    };

    // Create and initialize framework
    framework = new BuildSessionTestFrameworkImpl();
    await framework.initialize(testConfiguration);
  });

  afterEach(async () => {
    if (framework) {
      await framework.dispose();
    }
  });

  it('should initialize all components successfully', async () => {
    // Verify all components are accessible
    expect(framework.getTestManager()).toBeDefined();
    expect(framework.getSessionController()).toBeDefined();
    expect(framework.getEventCapture()).toBeDefined();
    expect(framework.getValidationManager()).toBeDefined();
    expect(framework.getErrorHandler()).toBeDefined();
    expect(framework.getEventBuffer()).toBeDefined();
    expect(framework.getReconnectionManager()).toBeDefined();
    expect(framework.getPerformanceMonitor()).toBeDefined();
    expect(framework.getScalabilityVerifier()).toBeDefined();
  });

  it('should run comprehensive test suite successfully', async () => {
    // Create test suite
    const testSuite: ComprehensiveTestSuite = {
      suiteId: 'integration-test-suite',
      name: 'Integration Test Suite',
      testCategories: [
        TestCategory.SessionSnapshotCapture,
        TestCategory.BuildSessionCreation,
        TestCategory.EventDelivery,
        TestCategory.Integration
      ],
      targetSessions: ['session-1', 'session-2'],
      validationRequirements: {
        accuracyThreshold: 0.95,
        performanceThreshold: 0.90,
        reliabilityThreshold: 0.99,
        scalabilityThreshold: 0.80
      }
    };

    // Run comprehensive tests
    const results = await framework.runComprehensiveTests(testSuite);

    // Verify results structure
    expect(results).toBeDefined();
    expect(results.suiteId).toBe('integration-test-suite');
    expect(results.startTime).toBeGreaterThan(0);
    expect(results.endTime).toBeGreaterThan(results.startTime);
    expect(results.totalDuration).toBeGreaterThan(0);
    expect(results.resultsByCategory).toBeDefined();
    expect(results.performanceMetrics).toBeDefined();
    expect(results.scalabilityMetrics).toBeDefined();
    expect(results.errorSummary).toBeDefined();
    expect(results.validationResults).toBeDefined();

    // Verify test categories were executed
    expect(results.resultsByCategory.size).toBe(4);
    expect(results.resultsByCategory.has(TestCategory.SessionSnapshotCapture)).toBe(true);
    expect(results.resultsByCategory.has(TestCategory.BuildSessionCreation)).toBe(true);
    expect(results.resultsByCategory.has(TestCategory.EventDelivery)).toBe(true);
    expect(results.resultsByCategory.has(TestCategory.Integration)).toBe(true);
  });

  it('should generate comprehensive report', async () => {
    // Create and run a simple test suite
    const testSuite: ComprehensiveTestSuite = {
      suiteId: 'report-test-suite',
      name: 'Report Test Suite',
      testCategories: [TestCategory.SessionSnapshotCapture],
      targetSessions: ['session-1'],
      validationRequirements: {
        accuracyThreshold: 0.95,
        performanceThreshold: 0.90,
        reliabilityThreshold: 0.99,
        scalabilityThreshold: 0.80
      }
    };

    await framework.runComprehensiveTests(testSuite);

    // Generate report
    const report = await framework.generateComprehensiveReport();

    // Verify report content
    expect(report).toBeDefined();
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('Build Session Comprehensive Test Report');
    expect(report).toContain('report-test-suite');
    expect(report).toContain('Performance Metrics');
    expect(report).toContain('Scalability Metrics');
  });

  it('should handle component configuration access', async () => {
    // Test configuration access for all components
    const testManager = framework.getTestManager();
    const testManagerConfig = testManager.getConfiguration();
    expect(testManagerConfig).toBeDefined();

    const sessionController = framework.getSessionController();
    const sessionControllerConfig = sessionController.getConfiguration();
    expect(sessionControllerConfig).toBeDefined();

    const eventCapture = framework.getEventCapture();
    const eventCaptureConfig = eventCapture.getConfiguration();
    expect(eventCaptureConfig).toBeDefined();

    const validationManager = framework.getValidationManager();
    const validationManagerConfig = validationManager.getConfiguration();
    expect(validationManagerConfig).toBeDefined();

    const errorHandler = framework.getErrorHandler();
    const errorHandlerConfig = errorHandler.getConfiguration();
    expect(errorHandlerConfig).toBeDefined();

    const reconnectionManager = framework.getReconnectionManager();
    const reconnectionManagerConfig = reconnectionManager.getConfiguration();
    expect(reconnectionManagerConfig).toBeDefined();

    const performanceMonitor = framework.getPerformanceMonitor();
    const performanceMonitorConfig = performanceMonitor.getConfiguration();
    expect(performanceMonitorConfig).toBeDefined();

    const scalabilityVerifier = framework.getScalabilityVerifier();
    const scalabilityVerifierConfig = scalabilityVerifier.getConfiguration();
    expect(scalabilityVerifierConfig).toBeDefined();
  });

  it('should handle disposal properly', async () => {
    // Framework should dispose without errors
    await expect(framework.dispose()).resolves.not.toThrow();

    // After disposal, component access should throw
    expect(() => framework.getTestManager()).toThrow();
    expect(() => framework.getSessionController()).toThrow();
    expect(() => framework.getEventCapture()).toThrow();
    expect(() => framework.getValidationManager()).toThrow();
  });
});