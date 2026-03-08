// General test utilities and helpers

import type { TestResult, TestSummary } from '../types/TestTypes.js';

/**
 * Utility functions for test execution and result processing
 */
export class TestUtils {
  /**
   * Generate a unique test ID
   */
  static generateTestId(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate test summary from results
   */
  static calculateTestSummary(results: TestResult[]): TestSummary {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const duration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      duration
    };
  }

  /**
   * Filter test results by criteria
   */
  static filterResults(
    results: TestResult[], 
    criteria: Partial<TestResult>
  ): TestResult[] {
    return results.filter(result => {
      return Object.entries(criteria).every(([key, value]) => {
        return result[key as keyof TestResult] === value;
      });
    });
  }

  /**
   * Group test results by scenario
   */
  static groupByScenario(results: TestResult[]): Record<string, TestResult[]> {
    return results.reduce((groups, result) => {
      const scenario = result.scenarioId;
      if (!groups[scenario]) {
        groups[scenario] = [];
      }
      groups[scenario].push(result);
      return groups;
    }, {} as Record<string, TestResult[]>);
  }

  /**
   * Validate test result structure
   */
  static validateTestResult(result: unknown): result is TestResult {
    if (typeof result !== 'object' || result === null) {
      return false;
    }

    const r = result as Record<string, unknown>;
    return (
      typeof r.testId === 'string' &&
      typeof r.scenarioId === 'string' &&
      typeof r.passed === 'boolean' &&
      typeof r.duration === 'number'
    );
  }

  /**
   * Create a test result with default values
   */
  static createTestResult(
    testId: string,
    scenarioId: string,
    passed: boolean,
    duration: number,
    error?: Error,
    metadata?: Record<string, unknown>
  ): TestResult {
    return {
      testId,
      scenarioId,
      passed,
      duration,
      ...(error && { error }),
      ...(metadata && { metadata })
    };
  }
}