// Core test framework types

export interface TestResult {
  testId: string;
  scenarioId: string;
  passed: boolean;
  duration: number;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface TestReport {
  testSuiteId: string;
  results: TestResult[];
  summary: TestSummary;
  generatedAt: number;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage?: TestCoverage;
}

export interface TestCoverage {
  requirements: RequirementCoverage[];
  properties: PropertyCoverage[];
}

export interface RequirementCoverage {
  requirementId: string;
  covered: boolean;
  testIds: string[];
}

export interface PropertyCoverage {
  propertyId: string;
  verified: boolean;
  iterations: number;
  counterExamples?: unknown[];
}

export interface ComprehensiveTestReport {
  testSuiteId: string;
  categories: TestCategoryReport[];
  overallSummary: TestSummary;
  generatedAt: number;
}

export interface TestCategoryReport {
  category: TestCategory;
  results: TestResult[];
  summary: TestSummary;
}

export type TestCategory = 
  | 'step5-tests'
  | 'lifecycle-tests'
  | 'event-stream-tests'
  | 'state-sync-tests'
  | 'buffering-tests'
  | 'error-handling-tests'
  | 'performance-tests';