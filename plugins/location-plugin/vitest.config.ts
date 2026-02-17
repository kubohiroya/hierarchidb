import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

const basePluginEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/tabular-store': path.resolve(__dirname, 'src/common/test-shims/external-mocks.ts'),
      '@hierarchidb/plugin-ui-sdk': basePluginEntry,
      '@hierarchidb/runtime-worker': path.resolve(__dirname, 'src/common/test-shims/runtime-worker.ts'),
      '@hierarchidb/ui-worker-client': path.resolve(__dirname, 'src/common/test-shims/runtime-worker.ts'),
      '@hierarchidb/ui-batch-progress': path.resolve(__dirname, 'src/common/test-shims/external-mocks.ts'),
      '@hierarchidb/ui-file': path.resolve(__dirname, 'src/common/test-shims/ui-file.ts'),
      '@hierarchidb/ui-i18n': path.resolve(__dirname, 'src/common/test-shims/ui-i18n.ts'),
      '@hierarchidb/map-adapter': path.resolve(__dirname, 'src/common/test-shims/optional-features.ts'),
      '@hierarchidb/tabular-xlsx': path.resolve(__dirname, 'src/common/test-shims/optional-features.ts'),
      '@hierarchidb/basemap-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/folder-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/resolver-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/route-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/spreadsheet-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/styler-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/shape-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/location-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/linker-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      '@hierarchidb/timeline-plugin/worker': path.resolve(__dirname, 'src/common/test-shims/plugin-worker-factory.ts'),
      // vt-pbf/geojson-vt are no longer imported in this package
    },
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
