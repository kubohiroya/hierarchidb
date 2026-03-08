/**
 * Comprehensive Test Suite
 * 
 * Orchestrates execution of all 7 test categories and generates comprehensive reports
 * for build session testing framework.
 */

import type {
  TestManager,
  ComprehensiveTestSuiteConfig,
  ComprehensiveTestReport,
  TestCategoryResult,
  TestSuiteExecutionOptions
} from '../types/index.js';

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
 * Comprehensive test suite that executes all test categories
 * and generates unified reports for build session testing.
 */
export class ComprehensiveTestSuite {
  private readonly testManager: TestManager;
  private readonly config: ComprehensiveTestSuiteConfig;

  constructor(testManager: TestManager, config: ComprehensiveTestSuiteConfig) {
    this.testManager = testManager;
    this.config = config;
  }

  /**
   * Execute all test categories in the comprehensive test suite
   */
  async executeAll(options: TestSuiteExecutionOptions = {}): Promise<ComprehensiveTestReport> {
    const startTime = Date.now();
    const results: TestCategoryResult[] = [];

    try {
      // Execute Step5 tests
      if (this.shouldExecuteCategory('step5', options)) {
        const step5Result = await this.executeStep5Tests(options.step5Scenarios);
        results.push(step5Result);
      }

      // Execute Lifecycle tests
      if (this.shouldExecuteCategory('lifecycle', options)) {
        const lifecycleResult = await this.executeLifecycleTests(options.lifecycleScenarios);
        results.push(lifecycleResult);
      }

      // Execute Event Stream tests
      if (this.shouldExecuteCategory('eventStream', options)) {
        const eventStreamResult = await this.executeEventStreamTests(options.eventStreamScenarios);
        results.push(eventStreamResult);
      }

      // Execute State Sync tests
      if (this.shouldExecuteCategory('stateSync', options)) {
        const stateSyncResult = await this.executeStateSyncTests(options.stateSyncScenarios);
        results.push(stateSyncResult);
      }

      // Execute Buffering tests
      if (this.shouldExecuteCategory('buffering', options)) {
        const bufferingResult = await this.executeBufferingTests(options.bufferingScenarios);
        results.push(bufferingResult);
      }

      // Execute Error Handling tests
      if (this.shouldExecuteCategory('errorHandling', options)) {
        const errorHandlingResult = await this.executeErrorHandlingTests(options.errorHandlingScenarios);
        results.push(errorHandlingResult);
      }

      // Execute Performance tests
      if (this.shouldExecuteCategory('performance', options)) {
        const performanceResult = await this.executePerformanceTests(options.performanceScenarios);
        results.push(performanceResult);
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      return this.generateComprehensiveReport(results, executionTime, startTime, endTime);

    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      return this.generateErrorReport(error, results, executionTime, startTime, endTime);
    }
  }

  /**
   * Execute Step5 display tests
   */
  private async executeStep5Tests(scenarios?: Step5TestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.step5;
      const testResults = await this.testManager.runStep5Tests(testScenarios);
      
      return {
        category: 'step5',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'step5',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute lifecycle tests
   */
  private async executeLifecycleTests(scenarios?: LifecycleTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.lifecycle;
      const testResults = await this.testManager.runLifecycleTests(testScenarios);
      
      return {
        category: 'lifecycle',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'lifecycle',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute event stream tests
   */
  private async executeEventStreamTests(scenarios?: EventStreamTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.eventStream;
      const testResults = await this.testManager.runEventStreamTests(testScenarios);
      
      return {
        category: 'eventStream',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'eventStream',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute state synchronization tests
   */
  private async executeStateSyncTests(scenarios?: StateSyncTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.stateSync;
      const testResults = await this.testManager.runStateSyncTests(testScenarios);
      
      return {
        category: 'stateSync',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'stateSync',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute buffering tests
   */
  private async executeBufferingTests(scenarios?: BufferingTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.buffering;
      const testResults = await this.testManager.runBufferingTests(testScenarios);
      
      return {
        category: 'buffering',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'buffering',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute error handling tests
   */
  private async executeErrorHandlingTests(scenarios?: ErrorHandlingTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.errorHandling;
      const testResults = await this.testManager.runErrorHandlingTests(testScenarios);
      
      return {
        category: 'errorHandling',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'errorHandling',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Execute performance tests
   */
  private async executePerformanceTests(scenarios?: PerformanceTestScenario[]): Promise<TestCategoryResult> {
    const categoryStartTime = Date.now();
    
    try {
      const testScenarios = scenarios || this.config.defaultScenarios.performance;
      const testResults = await this.testManager.runPerformanceTests(testScenarios);
      
      return {
        category: 'performance',
        status: 'completed',
        executionTime: Date.now() - categoryStartTime,
        testResults,
        summary: {
          total: testResults.length,
          passed: testResults.filter(r => r.status === 'passed').length,
          failed: testResults.filter(r => r.status === 'failed').length,
          skipped: testResults.filter(r => r.status === 'skipped').length
        }
      };
    } catch (error) {
      return {
        category: 'performance',
        status: 'failed',
        executionTime: Date.now() - categoryStartTime,
        error: error instanceof Error ? error.message : String(error),
        testResults: [],
        summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
      };
    }
  }

  /**
   * Check if a test category should be executed
   */
  private shouldExecuteCategory(
    category: string, 
    options: TestSuiteExecutionOptions
  ): boolean {
    if (options.excludeCategories?.includes(category)) {
      return false;
    }
    
    if (options.includeCategories && !options.includeCategories.includes(category)) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate comprehensive test report
   */
  private generateComprehensiveReport(
    results: TestCategoryResult[],
    executionTime: number,
    startTime: number,
    endTime: number
  ): ComprehensiveTestReport {
    const totalTests = results.reduce((sum, result) => sum + result.summary.total, 0);
    const totalPassed = results.reduce((sum, result) => sum + result.summary.passed, 0);
    const totalFailed = results.reduce((sum, result) => sum + result.summary.failed, 0);
    const totalSkipped = results.reduce((sum, result) => sum + result.summary.skipped, 0);

    const overallStatus = results.every(r => r.status === 'completed') ? 'completed' : 'failed';

    return {
      status: overallStatus,
      executionTime,
      startTime,
      endTime,
      categoryResults: results,
      summary: {
        totalCategories: results.length,
        completedCategories: results.filter(r => r.status === 'completed').length,
        failedCategories: results.filter(r => r.status === 'failed').length,
        totalTests,
        totalPassed,
        totalFailed,
        totalSkipped,
        successRate: totalTests > 0 ? (totalPassed / totalTests) * 100 : 0
      },
      metadata: {
        frameworkVersion: '1.0.0',
        testSuiteVersion: this.config.version || '1.0.0',
        executionEnvironment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      }
    };
  }

  /**
   * Generate error report when test suite execution fails
   */
  private generateErrorReport(
    error: unknown,
    partialResults: TestCategoryResult[],
    executionTime: number,
    startTime: number,
    endTime: number
  ): ComprehensiveTestReport {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      status: 'failed',
      executionTime,
      startTime,
      endTime,
      error: errorMessage,
      categoryResults: partialResults,
      summary: {
        totalCategories: partialResults.length,
        completedCategories: partialResults.filter(r => r.status === 'completed').length,
        failedCategories: partialResults.filter(r => r.status === 'failed').length + 1, // +1 for suite failure
        totalTests: partialResults.reduce((sum, result) => sum + result.summary.total, 0),
        totalPassed: partialResults.reduce((sum, result) => sum + result.summary.passed, 0),
        totalFailed: partialResults.reduce((sum, result) => sum + result.summary.failed, 0),
        totalSkipped: partialResults.reduce((sum, result) => sum + result.summary.skipped, 0),
        successRate: 0
      },
      metadata: {
        frameworkVersion: '1.0.0',
        testSuiteVersion: this.config.version || '1.0.0',
        executionEnvironment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      }
    };
  }
}