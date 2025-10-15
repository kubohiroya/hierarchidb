import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.ts');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/batch': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/tabular-store': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      '@hierarchidb/runtime-worker': path.resolve(__dirname, 'src/test-shims/runtime-worker.ts'),
      '@hierarchidb/runtime-client': path.resolve(__dirname, 'src/test-shims/runtime-worker.ts'),
      '@hierarchidb/map-adapter': path.resolve(__dirname, 'src/test-shims/optional-features.ts'),
      '@hierarchidb/tabular-xlsx': path.resolve(__dirname, 'src/test-shims/optional-features.ts'),
      '@hierarchidb/basemap-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/folder-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/resolver-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/route-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/spreadsheet-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/styler-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/shape-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/location-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/linker-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/timeline-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      // vt-pbf/geojson-vt are no longer imported in this package
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    globals: true,
    // Avoid EPERM from child process kills in sandboxed CI
    pool: 'threads',
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
