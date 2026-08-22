import * as path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.ts'],
  },
  resolve: {
    alias: {
      '@hierarchidb/core-types': path.resolve(workspaceRoot, 'packages/core-types/src/index.ts'),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
      '@hierarchidb/yaml-api/validation': path.resolve(
        workspaceRoot,
        'packages/yaml-api/src/validation/index.ts'
      ),
      '@hierarchidb/yaml-api': path.resolve(workspaceRoot, 'packages/yaml-api/src/index.ts'),
    },
  },
});
