import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.js');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/RuntimeWorkerService.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/batch': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/tabular-store': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      '@hierarchidb/runtime-worker': path.resolve(__dirname, 'src/test-shims/runtime-worker.ts'),
      '@hierarchidb/runtime-worker-bootstrap': path.resolve(__dirname, 'src/test-shims/runtime-worker.ts'),
      '@hierarchidb/map-adapter': path.resolve(__dirname, 'src/test-shims/optional-features.ts'),
      '@hierarchidb/tabular-xlsx': path.resolve(__dirname, 'src/test-shims/optional-features.ts'),
      '@hierarchidb/plugins-basemap-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-folder-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-resolver-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-route-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-spreadsheet-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-styler-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-shape-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-location-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-linker-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/plugins-timeline-plugin/worker-factory': path.resolve(__dirname, 'src/test-shims/plugin-worker-factory.ts'),
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
