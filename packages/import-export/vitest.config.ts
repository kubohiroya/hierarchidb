import { defineConfig } from 'vitest/config';
import path from 'node:path';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@hierarchidb/core-types': path.resolve(workspaceRoot, 'packages/core-types/dist/index.js'),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/dist/index.js'),
      '@hierarchidb/import-export-api': path.resolve(
        workspaceRoot,
        'packages/import-export-api/dist/index.js',
      ),
      '@hierarchidb/tree-api': path.resolve(workspaceRoot, 'packages/tree-api/dist/index.js'),
    },
  },
});
