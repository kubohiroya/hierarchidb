import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    exclude: ['playwright/**', 'node_modules/**'],
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
      'node-fetch': path.resolve(__dirname, '../../../app/src/virtual/node-fetch.ts'),
    },
  },
});
