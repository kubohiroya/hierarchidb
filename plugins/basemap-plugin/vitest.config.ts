import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'path';

const pluginSdkDistEntry = path.resolve(__dirname, '../../plugin-ui-sdk/dist/index.ts');
const pluginSdkSrcEntry = path.resolve(__dirname, '../../plugin-ui-sdk/src/index.ts');
const pluginSdkEntry = fs.existsSync(pluginSdkDistEntry) ? pluginSdkDistEntry : pluginSdkSrcEntry;

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
      '~': 'src/*',
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.ts'),
      '@hierarchidb/plugin-ui-sdk': pluginSdkEntry,
      '@hierarchidb/folder-plugin': path.resolve(__dirname, '../folder-plugin/dist/index.ts'),
    },
  },
});
