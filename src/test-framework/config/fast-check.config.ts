// fast-check configuration for property-based testing

import fc from 'fast-check';

/**
 * Global configuration for fast-check property-based testing
 */
export const FastCheckConfig = {
  /**
   * Default number of test runs for property tests
   */
  DEFAULT_NUM_RUNS: 100,

  /**
   * Number of runs for performance-critical tests
   */
  PERFORMANCE_NUM_RUNS: 50,

  /**
   * Number of runs for comprehensive integration tests
   */
  COMPREHENSIVE_NUM_RUNS: 200,

  /**
   * Default timeout for property tests (milliseconds)
   */
  DEFAULT_TIMEOUT: 30000,

  /**
   * Seed for reproducible test runs (set to null for random)
   */
  SEED: null as number | null,

  /**
   * Verbose output configuration
   */
  VERBOSE: true,

  /**
   * Whether to stop on first failure
   */
  END_ON_FAILURE: false,

  /**
   * Maximum shrinking iterations
   */
  MAX_SHRINKS: 1000
};

/**
 * Create standard property test parameters
 */
export function createPropertyTestParams(overrides: Partial<fc.Parameters<unknown>> = {}): fc.Parameters<unknown> {
  return {
    numRuns: FastCheckConfig.DEFAULT_NUM_RUNS,
    verbose: FastCheckConfig.VERBOSE,
    seed: FastCheckConfig.SEED || Math.floor(Math.random() * 1000000),
    endOnFailure: FastCheckConfig.END_ON_FAILURE,
    maxSkipsPerRun: 100,
    timeout: FastCheckConfig.DEFAULT_TIMEOUT,
    ...overrides
  };
}

/**
 * Create performance test parameters with reduced iterations
 */
export function createPerformanceTestParams(overrides: Partial<fc.Parameters<unknown>> = {}): fc.Parameters<unknown> {
  return createPropertyTestParams({
    numRuns: FastCheckConfig.PERFORMANCE_NUM_RUNS,
    timeout: FastCheckConfig.DEFAULT_TIMEOUT * 2,
    ...overrides
  });
}

/**
 * Create comprehensive test parameters with increased iterations
 */
export function createComprehensiveTestParams(overrides: Partial<fc.Parameters<unknown>> = {}): fc.Parameters<unknown> {
  return createPropertyTestParams({
    numRuns: FastCheckConfig.COMPREHENSIVE_NUM_RUNS,
    timeout: FastCheckConfig.DEFAULT_TIMEOUT * 3,
    ...overrides
  });
}

/**
 * Property test wrapper with standard configuration
 */
export function runPropertyTest<T>(
  generator: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>,
  params?: Partial<fc.Parameters<unknown>>
): void {
  fc.assert(
    fc.asyncProperty(generator, predicate),
    createPropertyTestParams(params)
  );
}

/**
 * Performance property test wrapper
 */
export function runPerformancePropertyTest<T>(
  generator: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>,
  params?: Partial<fc.Parameters<unknown>>
): void {
  fc.assert(
    fc.asyncProperty(generator, predicate),
    createPerformanceTestParams(params)
  );
}

/**
 * Comprehensive property test wrapper
 */
export function runComprehensivePropertyTest<T>(
  generator: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean>,
  params?: Partial<fc.Parameters<unknown>>
): void {
  fc.assert(
    fc.asyncProperty(generator, predicate),
    createComprehensiveTestParams(params)
  );
}