import { defineConfig } from 'vitest/config';
import path from 'path';

const entityServiceEntry = path.resolve(__dirname, '../../packages/plugin-runtime-services/src/index.ts');

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/ui/components/__tests__/setup.ts'],
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
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/util': path.resolve(__dirname, '../../packages/util/src/index.ts'),
      '@hierarchidb/plugin-runtime-services': entityServiceEntry,
      '@hierarchidb/download': path.resolve(__dirname, '../../packages/features/download/src/index.ts'),
      '@hierarchidb/runtime-client': path.resolve(__dirname, '../../packages/runtime/client/src/index.ts'),
    },
  },
});
