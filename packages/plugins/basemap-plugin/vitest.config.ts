import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'path';

const pluginSdkDistEntry = path.resolve(__dirname, '../../plugin-sdk/dist/index.js');
const pluginSdkSrcEntry = path.resolve(__dirname, '../../plugin-sdk/src/RuntimeWorkerService.ts');
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
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.js'),
      '@hierarchidb/plugin-sdk': pluginSdkEntry,
      '@hierarchidb/plugins-folder-plugin': path.resolve(__dirname, '../folder-plugin/dist/index.js'),
    },
  },
});
