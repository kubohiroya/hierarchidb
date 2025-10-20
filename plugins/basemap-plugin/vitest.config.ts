import { defineConfig } from 'vitest/config';
import path from 'path';

const pluginSdkEntry = path.resolve(__dirname, '../../plugin-ui-sdk/src/index.ts');

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/**/*.js',
    ],
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
      '@hierarchidb/util': path.resolve(__dirname, '../../util/src/index.ts'),
      '@hierarchidb/plugin-ui-sdk': pluginSdkEntry,
      '@hierarchidb/folder-plugin': path.resolve(__dirname, '../folder-plugin/src/index.ts'),
    },
  },
});
