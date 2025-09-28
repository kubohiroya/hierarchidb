import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@hierarchidb/batch': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/tabular-store': path.resolve(__dirname, 'src/test-shims/external-mocks.ts'),
      '@hierarchidb/plugins-base-plugin': path.resolve(__dirname, '../base-plugin/src/index.ts'),
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
