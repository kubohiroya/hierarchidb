import { defineConfig } from 'vitest/config';
import path from 'path';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
      '@hierarchidb/tabular-store': path.resolve(
        workspaceRoot,
        'packages/tabular-store/src/index.ts'
      ),
      '@hierarchidb/tabular-source': path.resolve(
        workspaceRoot,
        'packages/tabular-source/src/index.ts'
      ),
      '@hierarchidb/ui-tabular': path.resolve(
        workspaceRoot,
        'packages/ui/tabular-extract/src/index.ts'
      ),
    },
  },
});
