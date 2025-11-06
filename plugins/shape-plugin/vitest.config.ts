import { defineConfig } from 'vitest/config';
import * as path from 'path';

const entityServiceEntry = path.resolve(__dirname, '../../packages/plugin-runtime-services/src/index.ts');

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
    // maxThreads: 1,
    // minThreads: 1,
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
      '@hierarchidb/core': path.resolve(__dirname, '../../packages/common/types/src/index.ts'),
      '@hierarchidb/common-types': path.resolve(__dirname, '../../packages/common/types/src/index.ts'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../packages/common/api/src/index.ts'),
      '@hierarchidb/runtime-client': path.resolve(__dirname, '../../packages/runtime/client/src/index.ts'),
      '@hierarchidb/runtime-worker': path.resolve(__dirname, '../../packages/runtime/worker/src/index.ts'),
      '@hierarchidb/plugin-ui-host': path.resolve(__dirname, '../../packages/plugin-ui-host/src/index.ts'),
      '@hierarchidb/runtime-ui-datasource': path.resolve(__dirname, '../../packages/runtime-ui/datasource/src/index.ts'),
      '@hierarchidb/ui-lru-splitview': path.resolve(__dirname, '../../packages/ui/lru-splitview/src/index.ts'),
      '@hierarchidb/plugin-runtime-services': entityServiceEntry,
      '@hierarchidb/download': path.resolve(
        __dirname,
        '../../packages/features/download/src/index.ts',
      ),
      '~': path.resolve(__dirname, './src'),
      // App client hook is now injected via registerWorkerClientHook in tests
    },
  },
});
