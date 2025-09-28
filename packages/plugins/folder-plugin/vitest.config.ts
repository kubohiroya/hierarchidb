import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
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
      '~': path.resolve(__dirname, './src'),
      // Use source during tests to avoid requiring a prebuild
      '@hierarchidb/ui-dialog': path.resolve(__dirname, '../../ui/dialog/src/index.ts'),
      '@hierarchidb/runtime-worker': path.resolve(__dirname, './src/__tests__/__mocks__/store-registry.ts'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.js'),
      '@hierarchidb/plugins-base-plugin': path.resolve(__dirname, '../base-plugin/src/index.ts'),
    },
  },
});
