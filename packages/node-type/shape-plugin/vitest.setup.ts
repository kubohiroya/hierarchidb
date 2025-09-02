/**
 * shape-plugin Test Setup
 * Uses base vitest setup configuration
 */

// Import base setup (includes common mocks and utilities)
import '../../../vitest.setup.base';

// Default: disable network-heavy and deep worker tests unless explicitly enabled
if (!('ENABLE_INTEGRATION_TESTS' in process.env)) {
  // eslint-disable-next-line no-console
  console.log('[shape-plugin tests] ENABLE_INTEGRATION_TESTS not set: network integration specs will be skipped');
  (process as any).env.ENABLE_INTEGRATION_TESTS = '';
}
if (!('ENABLE_SHAPE_DEEP_TESTS' in process.env)) {
  // eslint-disable-next-line no-console
  console.log('[shape-plugin tests] ENABLE_SHAPE_DEEP_TESTS not set: heavy worker specs will be skipped');
  (process as any).env.ENABLE_SHAPE_DEEP_TESTS = '';
}

// Package-specific setup can be added here if needed
