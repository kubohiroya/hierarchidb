import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Use mock WorkerAPI for integration-like tests
      '@hierarchidb/runtime-worker-worker/WorkerAPIImpl': path.resolve(
        __dirname,
        './src/tests/mocks/WorkerAPIImpl.ts',
      ),
      '@hierarchidb/folder-plugin': path.resolve(
        __dirname,
        '../../node-type/folder-plugin/src/index.ts',
      ),
      '@hierarchidb/folder-plugin/src': path.resolve(
        __dirname,
        '../../node-type/folder-plugin/src',
      ),
      '@hierarchidb/linker-plugin': path.resolve(
        __dirname,
        '../../node-type/linker-plugin/src/index.ts',
      ),
      '@hierarchidb/linker-plugin/src': path.resolve(
        __dirname,
        '../../node-type/linker-plugin/src',
      ),
      '@hierarchidb/basemap-plugin': path.resolve(
        __dirname,
        '../../node-type/basemap-plugin/src/index.ts',
      ),
      '@hierarchidb/basemap-plugin/src': path.resolve(
        __dirname,
        '../../node-type/basemap-plugin/src',
      ),
      '@hierarchidb/styler-plugin': path.resolve(
        __dirname,
        '../../node-type/styler-plugin/src/index.ts',
      ),
      '@hierarchidb/styler-plugin/src': path.resolve(
        __dirname,
        '../../node-type/styler-plugin/src',
      ),
      '@hierarchidb/resolver-plugin': path.resolve(
        __dirname,
        '../../node-type/resolver-plugin/src/index.ts',
      ),
      '@hierarchidb/resolver-plugin/src': path.resolve(
        __dirname,
        '../../node-type/resolver-plugin/src',
      ),
      '@hierarchidb/route-plugin': path.resolve(
        __dirname,
        '../../node-type/route-plugin/src/index.ts',
      ),
      '@hierarchidb/route-plugin/src': path.resolve(
        __dirname,
        '../../node-type/route-plugin/src',
      ),
      '@hierarchidb/location-plugin': path.resolve(
        __dirname,
        '../../node-type/location-plugin/src/index.ts',
      ),
      '@hierarchidb/location-plugin/src': path.resolve(
        __dirname,
        '../../node-type/location-plugin/src',
      ),
      '@hierarchidb/shape-plugin': path.resolve(
        __dirname,
        '../../node-type/shape-plugin/src/index.ts',
      ),
      '@hierarchidb/shape-plugin/src': path.resolve(
        __dirname,
        '../../node-type/shape-plugin/src',
      ),
      '@hierarchidb/spreadsheet-plugin': path.resolve(
        __dirname,
        '../../node-type/spreadsheet-plugin/src/index.ts',
      ),
      '@hierarchidb/spreadsheet-plugin/src': path.resolve(
        __dirname,
        '../../node-type/spreadsheet-plugin/src',
      ),
    },
  },
});
