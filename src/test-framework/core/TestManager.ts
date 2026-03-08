// TestManager - Test execution control and result aggregation layer

import type {
  TestResult,
  TestReport,
  ComprehensiveTestReport,
  TestCategory
} from '../types/TestTypes.js';
import type {
  Step5TestScenario,
  LifecycleTestScenario,
  EventStreamTestScenario,
  StateSyncTestScenario,
  BufferingTestScenario,
  ErrorHandlingTestScenario,
  PerformanceTestScenario
} from '../types/ScenarioTypes.js';

/**
 * TestManager - Core test execution controller
 * 
 * Manages the execution of all test categories and aggregates results
 * into comprehensive reports. Coordinates with other layers to provide
 * end-to-end test orchestration.
 */
export interface TestManager {
  // Test execution control
  runStep5Tests(scenarios: Step5TestScenario[]): Promise<TestResult[]>;
  runLifecycleTests(scenarios: LifecycleTestScenario[]): Promise<TestResult[]>;
  runEventStreamTests(scenarios: EventStreamTestScenario[]): Promise<TestResult[]>;
  runStateSyncTests(scenarios: StateSyncTestScenario[]): Promise<TestResult[]>;
  runBufferingTests(scenarios: BufferingTestScenario[]): Promise<TestResult[]>;
  runErrorHandlingTests(scenarios: ErrorHandlingTestScenario[]): Promise<TestResult[]>;
  runPerformanceTests(scenarios: PerformanceTestScenario[]): Promise<TestResult[]>;
  
  // Test suite management
  runComprehensiveTestSuite(): Promise<ComprehensiveTestReport>;
  generateTestReport(results: TestResult[]): TestReport;
  
  // Test configuration and lifecycle
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  
  // Test execution monitoring
  getTestProgress(): TestProgress;
  cancelRunningTests(): Promise<void>;
}

export interface TestProgress {
  totalTests: number;
  completedTests: number;
  runningTests: number;
  failedTests: number;
  currentCategory?: TestCategory;
  estimatedTimeRemaining?: number;
}