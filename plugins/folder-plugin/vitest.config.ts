import * as path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');
const basePluginEntry = path.resolve(workspaceRoot, 'packages/plugin-ui-sdk/src/index.ts');

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/*.stories.{ts,tsx}', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      // Use source during tests to avoid requiring a prebuild
      '@hierarchidb/ui-dialog': path.resolve(workspaceRoot, 'packages/ui/dialog/src/index.ts'),
      '@hierarchidb/runtime-worker': path.resolve(
        __dirname,
        './src/_obsolate_common/__tests__/store-registry-mocks.ts'
      ),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
      '@hierarchidb/plugin-ui-sdk': basePluginEntry,
      '@hierarchidb/yaml-api/validation': path.resolve(
        workspaceRoot,
        'packages/yaml-api/src/validation/index.ts'
      ),
      '@hierarchidb/yaml-api': path.resolve(workspaceRoot, 'packages/yaml-api/src/index.ts'),
      '@hierarchidb/core-types': path.resolve(workspaceRoot, 'packages/core-types/src/index.ts'),
    },
  },
});
