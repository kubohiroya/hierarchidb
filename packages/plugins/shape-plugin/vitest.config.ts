import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Use threads pool to avoid child-process kill errors in sandboxed CI
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    exclude: [
      'src/**/migration/**',
      'src/**/__tests__/integration/**',
      'src/services/workers/__tests__/**',
      'src/services/**/__tests__/**',
      'src/worker/**/__tests__/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
    testTimeout: 3000, // 3 seconds for faster feedback
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/*.stories.{ts,tsx}', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      // Map legacy core imports to public dist builds for tests
      '@hierarchidb/core': path.resolve(__dirname, '../../common/types/dist/index.js'),
      '@hierarchidb/common-type': path.resolve(__dirname, '../../common/types/dist/index.js'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/dist/index.js'),
      '@hierarchidb/runtime-worker-bootstrap': path.resolve(__dirname, '../../runtime-worker/worker-bootstrap/dist/index.js'),
      '@hierarchidb/runtime-worker-worker': path.resolve(__dirname, '../../runtime-worker/worker/dist/index.js'),
      '@hierarchidb/runtime-ui-datasource': path.resolve(__dirname, '../../runtime-ui/datasource/dist/index.js'),
      '@hierarchidb/ui-lru-splitview': path.resolve(__dirname, '../../ui/lru-splitview/dist/index.js'),
      '@hierarchidb/plugins-base-plugin': path.resolve(__dirname, '../base-plugin/src/index.ts'),
      '~': path.resolve(__dirname, './src'),
      // App client hook is now injected via registerWorkerClientHook in tests
    },
  },
});
