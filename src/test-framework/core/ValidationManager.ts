// ValidationManager - State verification, assertion, and report generation layer

import type {
  NodeId,
  SessionId,
  TaskSnapshot
} from '../types/SessionTypes.js';
import type {
  ValidationResult,
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
 * ValidationManager - Comprehensive state and performance validation
 * 
 * Provides validation capabilities for UI state, session state, task snapshots,
 * and performance metrics. Generates detailed validation reports with
 * actionable insights for test result analysis.
 */
export interface ValidationManager {
  // UI state validation
  validateStep5Display(nodeId: NodeId, expectedState: ExpectedUIState): ValidationResult;
  validateProgressDisplay(nodeId: NodeId, expectedProgress: ExpectedProgress): ValidationResult;
  
  // Session state validation
  validateSessionState(sessionId: SessionId, expectedState: ExpectedSessionState): ValidationResult;
  validateTaskSnapshots(snapshots: TaskSnapshot[], expectedTasks: ExpectedTask[]): ValidationResult;
  
  // Performance validation
  validatePerformanceMetrics(metrics: PerformanceMetrics, constraints: PerformanceConstraints): ValidationResult;
  validateResourceUsage(usage: ResourceUsage, limits: ResourceLimits): ValidationResult;
  
  // Cross-component validation
  validateSessionUIConsistency(sessionId: SessionId, nodeId: NodeId): ValidationResult;
  validateEventUIReflection(nodeId: NodeId, timeWindow: number): ValidationResult;
  
  // Validation reporting
  generateValidationReport(results: ValidationResult[]): ValidationReport;
  generatePerformanceReport(metrics: PerformanceMetrics[]): PerformanceReport;
  
  // Validation configuration
  setValidationThresholds(thresholds: ValidationThresholds): void;
  getValidationThresholds(): ValidationThresholds;
  
  // Validation utilities
  compareStates<T>(actual: T, expected: T, tolerance?: number): StateComparisonResult<T>;
  validateDataIntegrity(data: unknown, schema: ValidationSchema): ValidationResult;
}

export interface ValidationReport {
  reportId: string;
  generatedAt: number;
  overallResult: ValidationResult;
  categoryResults: CategoryValidationResult[];
  recommendations: string[];
  summary: ValidationSummary;
}

export interface CategoryValidationResult {
  category: string;
  result: ValidationResult;
  testCount: number;
  passRate: number;
}

export interface ValidationSummary {
  totalValidations: number;
  passedValidations: number;
  failedValidations: number;
  warningCount: number;
  criticalIssues: number;
}

export interface PerformanceReport {
  reportId: string;
  generatedAt: number;
  metrics: PerformanceMetrics[];
  benchmarks: PerformanceTestBenchmark[];
  trends: PerformanceTrend[];
  recommendations: string[];
}

export interface PerformanceTestBenchmark {
  name: string;
  baseline: number;
  current: number;
  improvement: number; // percentage
  status: 'improved' | 'degraded' | 'stable';
}

export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number; // change per unit time
  confidence: number; // 0-1
}

export interface ValidationThresholds {
  performanceTolerancePercent: number;
  latencyThresholdMs: number;
  memoryThresholdMB: number;
  errorRateThreshold: number;
}

export interface StateComparisonResult<T> {
  isEqual: boolean;
  differences: StateDifference[];
  similarity: number; // 0-1
  actual: T;
  expected: T;
}

export interface StateDifference {
  path: string;
  actualValue: unknown;
  expectedValue: unknown;
  type: 'missing' | 'extra' | 'different' | 'type-mismatch';
}

export interface ValidationSchema {
  type: string;
  properties?: Record<string, ValidationSchema>;
  required?: string[];
  constraints?: Record<string, unknown>;
}