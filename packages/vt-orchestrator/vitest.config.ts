import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.unit.test.ts',
      'src/**/__tests__/**/*.ts',
    ],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/core-types': path.resolve(workspaceRoot, 'packages/core-types/dist/index.js'),
      '@hierarchidb/build-api': path.resolve(workspaceRoot, 'packages/build-api/dist/index.js'),
      '@hierarchidb/gis-sdk': path.resolve(workspaceRoot, 'packages/gis-sdk/dist/index.js'),
      '@hierarchidb/shape-api': path.resolve(workspaceRoot, 'packages/shape-api/dist/index.js'),
      '@hierarchidb/chunk-store': path.resolve(workspaceRoot, 'packages/chunk-store/dist/index.js'),
    },
  },
});
