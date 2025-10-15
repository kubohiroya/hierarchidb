import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'path';
const RUN_ROUTE_TESTS = process.env.ROUTE_TESTS === '1';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.ts');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    pool: 'threads',
    include: RUN_ROUTE_TESTS ? [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ] : [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(RUN_ROUTE_TESTS ? [] : ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}']),
    ],
  },
  resolve: {
    alias: {
      '@hierarchidb/plugin-sdk': basePluginEntry,
    },
  },
});
