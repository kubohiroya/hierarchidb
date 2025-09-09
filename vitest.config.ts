import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
    root: process.cwd(),
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: [
        'app/**/*.{ts,tsx}',
        'packages/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/*.stories.{ts,tsx}',
        '**/dist/**',
        '**/build/**',
        '**/storybook-static/**',
        '**/e2e/**',
        '**/references/**'
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      }
    }
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './packages/ui/core/src'),
      '@hierarchidb/ui-core': path.resolve(__dirname, './packages/ui/core/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, './packages/common/api/src'),
      // Note: common-core package has been removed. Use common-type/common-api.
      '@hierarchidb/runtime-worker-worker': path.resolve(__dirname, './packages/runtime-worker/worker/src'),
      // For integration tests, point WorkerAPIImpl to mock implementation
      '@hierarchidb/runtime-worker-worker/WorkerAPIImpl': path.resolve(
        __dirname,
        './packages/runtime-ui/plugin-dialog/src/tests/mocks/WorkerAPIImpl.ts',
      ),
      '@hierarchidb/util': path.resolve(__dirname, './packages/util/src/index.ts'),
    },
  },
});
