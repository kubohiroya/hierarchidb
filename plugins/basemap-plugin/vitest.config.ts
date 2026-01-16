import { defineConfig } from 'vitest/config';
import path from 'path';

const workspaceRoot = path.resolve(__dirname, '../..');
const pluginSdkEntry = path.resolve(workspaceRoot, 'packages/plugin-ui-sdk/src/index.ts');

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/**/*.js',
    ],
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
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
      '@hierarchidb/plugin-ui-sdk': pluginSdkEntry,
      '@hierarchidb/folder-plugin': path.resolve(__dirname, '../folder-plugin/src/index.ts'),
      '@hierarchidb/ui-i18n': path.resolve(workspaceRoot, 'packages/ui/i18n/src/index.ts'),
      '@hierarchidb/ui-worker-client': path.resolve(
        workspaceRoot,
        'packages/ui/worker-client/src/index.ts'
      ),
      '@hierarchidb/ui-worker-provider': path.resolve(
        workspaceRoot,
        'packages/ui/worker-provider/src/index.ts'
      ),
    },
  },
});
