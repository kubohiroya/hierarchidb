import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.js');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
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
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.js'),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      // Needed when ui/core (dist) imports runtime-worker-bootstrap
      '@hierarchidb/runtime-worker-bootstrap': path.resolve(
        __dirname,
        '../../runtime-worker/worker-bootstrap/src/index.ts',
      ),
    },
  },
});
