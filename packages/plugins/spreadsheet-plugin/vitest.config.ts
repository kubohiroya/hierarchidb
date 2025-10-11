import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.js');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

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
      '@hierarchidb/plugin-sdk': basePluginEntry,
    },
  },
});
