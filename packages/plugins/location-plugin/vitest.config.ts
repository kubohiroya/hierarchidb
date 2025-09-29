import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.js');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/batch': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/tabular-store': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/plugins-base-plugin': basePluginEntry,
      // vt-pbf/geojson-vt are no longer imported in this package
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    globals: true,
    // Avoid EPERM from child process kills in sandboxed CI
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
});
