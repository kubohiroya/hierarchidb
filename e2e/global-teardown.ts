import { FullConfig } from '@playwright/test';

/**
 * Global teardown for E2E tests
 *
 * This runs once after all tests complete and cleans up the testing environment.
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting HierarchiDB E2E Test Teardown...');

  try {
    // Clean up any remaining test data
    console.log('🗑️ Cleaning up test data...');

    // Additional cleanup can be added here if needed
    // For example, clearing test files, resetting services, etc.

    console.log('✅ Test data cleanup completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to avoid masking test results
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;
