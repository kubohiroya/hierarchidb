/**
 * Worker Package Test Setup
 * Uses base setup with worker-specific configurations
 */

// Import base setup (includes all common mocks)
// Minimal worker-specific test setup for isolated unit tests.
// Intentionally avoids importing monorepo-wide setup to prevent tsconfig resolution issues.

// Bridge legacy tests that set process.env flags to FEATURE_FLAGS on globalThis.
// This keeps production code free of `process` while preserving existing tests.
const g: any = (globalThis as any);
g.FEATURE_FLAGS = g.FEATURE_FLAGS || {};
const env: any = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
const keys = [
  'WORKER_METRICS_ENABLED',
  'WORKER_TX_ENABLED',
  'WORKER_PROGRESS_COMMON_TYPES',
  'LOCATION_DOWNLOAD_STRATEGY',
  'SHAPE_DOWNLOAD_STRATEGY',
];
for (const k of keys) if (env[k] != null) g.FEATURE_FLAGS[k] = env[k];
