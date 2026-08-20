import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

const basePluginEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: '@hierarchidb/tabular-store', replacement: path.resolve(__dirname, 'src/common/test-shims/external-mocks.ts') },
      { find: '@hierarchidb/plugin-ui-sdk', replacement: basePluginEntry },
      { find: '@hierarchidb/runtime-worker', replacement: path.resolve(__dirname, 'src/common/test-shims/runtimeWorkerUtils.ts') },
      { find: '@hierarchidb/ui-worker-client', replacement: path.resolve(__dirname, 'src/common/test-shims/runtimeWorkerUtils.ts') },
      { find: '@hierarchidb/ui-build-progress', replacement: path.resolve(__dirname, 'src/common/test-shims/external-mocks.ts') },
      { find: '@hierarchidb/ui-file', replacement: path.resolve(__dirname, 'src/common/test-shims/ui-file.ts') },
      { find: '@hierarchidb/map-adapter', replacement: path.resolve(__dirname, 'src/common/test-shims/optional-features.ts') },
      { find: '@hierarchidb/spreadsheet-plugin', replacement: path.resolve(__dirname, 'src/common/test-shims/spreadsheet-plugin.ts') },
      { find: '@hierarchidb/tabular-xlsx', replacement: path.resolve(__dirname, 'src/common/test-shims/optional-features.ts') },
      { find: '@hierarchidb/basemap-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/folder-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/resolver-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/route-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/spreadsheet-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/styler-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/shape-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/location-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/linker-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      { find: '@hierarchidb/timeline-plugin/worker', replacement: path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts') },
      // vt-pbf/geojson-vt are no longer imported in this package
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.ts')],
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
