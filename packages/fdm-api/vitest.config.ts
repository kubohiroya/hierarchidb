import path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: [
      {
        find: '@hierarchidb/core-types',
        replacement: path.resolve(workspaceRoot, 'packages/core-types/src/index.ts'),
      },
      {
        find: '@hierarchidb/ide-gsm-client',
        replacement: path.resolve(workspaceRoot, 'packages/ide-gsm-client/src/index.ts'),
      },
    ],
  },
});
