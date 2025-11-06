import { defineConfig } from 'vitest/config';
import * as path from 'path';

const entityServiceEntry = path.resolve(__dirname, '../../packages/plugin-runtime-services/src/index.ts');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
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
      '@hierarchidb/plugin-runtime-services': entityServiceEntry,
      '@hierarchidb/download': path.resolve(__dirname, '../../packages/features/download/src/index.ts'),
    },
  },
});
