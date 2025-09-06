import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],

    exclude: [
      'src/**/migration/**',
      'src/**/__tests__/integration/**',
      'src/services/workers/__tests__/**',
      'src/services/**/__tests__/**',
      'src/worker/**/__tests__/**',
      '**/node_modules/**',
      '**/dist/**'
    ],
    testTimeout: 3000, // 3 seconds for faster feedback
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/*.stories.{ts,tsx}', '**/dist/**']
    }
  },
  resolve: {
    alias: {
      '@hierarchidb/core': path.resolve(__dirname, '../../common/core/src'),
      '@hierarchidb/common-type': path.resolve(__dirname, '../../common/types/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/src'),
      '@hierarchidb/runtime-worker-worker': path.resolve(__dirname, '../../runtime-worker/worker/src'),
      '@hierarchidb/runtime-ui-datasource': path.resolve(__dirname, '../../runtime-ui/datasource/src'),
      '@hierarchidb/ui-lru-splitview': path.resolve(__dirname, '../../ui/lru-splitview/src'),
      '~': path.resolve(__dirname, './src'),
      '@hierarchidb/app/src/hooks/useWorkerAPIClient': path.resolve(__dirname, './src/ui/__tests__/mocks/useWorkerAPIClient.ts'),
    },
  },
});
