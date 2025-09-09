import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/__tests__/**/*.ts',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@hierarchidb/common-type': path.resolve(__dirname, '../../common/types/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/src'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
});
