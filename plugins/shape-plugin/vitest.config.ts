import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Use threads pool to avoid child-process kill errors in sandboxed CI
    pool: 'threads',
    // maxThreads: 1,
    // minThreads: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    exclude: [
      'src/**/migration/**',
      'src/**/__tests__/integration/**',
      'src/services/workers/__tests__/**',
      'src/services/**/__tests__/**',
      'src/worker/**/__tests__/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
    testTimeout: 3000, // 3 seconds for faster feedback
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
    alias: [
      // Map legacy core imports to public dist builds for tests
      {
        find: '@hierarchidb/core',
        replacement: path.resolve(__dirname, '../../packages/common/types/src/index.ts'),
      },
      {
        find: '@hierarchidb/common-types',
        replacement: path.resolve(__dirname, '../../packages/common/types/src/index.ts'),
      },
      {
        find: '@hierarchidb/common-api',
        replacement: path.resolve(__dirname, '../../packages/common/api/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-worker-client',
        replacement: path.resolve(__dirname, '../../packages/ui/worker-client/src/index.ts'),
      },
      {
        find: '@hierarchidb/runtime-worker',
        replacement: path.resolve(__dirname, '../../packages/runtime-worker/src/index.ts'),
      },
      {
        find: '@hierarchidb/plugin-ui-host',
        replacement: path.resolve(__dirname, '../../packages/plugin-ui-host/src/index.ts'),
      },
      {
        find: '@hierarchidb/runtime-ui-datasource',
        replacement: path.resolve(
          __dirname,
          '../../packages/runtime-worker-ui/datasource/src/index.ts',
        ),
      },
      {
        find: '@hierarchidb/ui-lru-splitview',
        replacement: path.resolve(__dirname, '../../packages/ui/lru-splitview/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-i18n',
        replacement: path.resolve(__dirname, '../../packages/ui/i18n/src/index.ts'),
      },
      {
        find: '@hierarchidb/auth-recovery',
        replacement: path.resolve(__dirname, './src/headless/mocks/auth-recovery.ts'),
      },
      {
        find: '@hierarchidb/resolver-plugin/database',
        replacement: path.resolve(
          __dirname,
          '../../plugins/resolver-plugin/src/worker/database/index.ts',
        ),
      },
      {
        find: '@hierarchidb/location-plugin/database',
        replacement: path.resolve(__dirname, '../../plugins/location-plugin/src/database/index.ts'),
      },
      {
        find: '@hierarchidb/download',
        replacement: path.resolve(__dirname, '../../packages/features/download/src/index.ts'),
      },
      {
        find: '@hierarchidb/shape-store',
        replacement: path.resolve(__dirname, '../../packages/features/shape-store/src/index.ts'),
      },
      {
        find: '@hierarchidb/vt-orchestrator',
        replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/index.ts'),
      },
      {
        find: /^@hierarchidb\/gen-iso3166-2\/browser$/,
        replacement: path.resolve(
          __dirname,
          '../../packages/tools/gen-iso3166-2/src/browser.ts',
        ),
      },
      {
        find: /^@hierarchidb\/gen-iso3166-2$/,
        replacement: path.resolve(
          __dirname,
          '../../packages/tools/gen-iso3166-2/src/index.ts',
        ),
      },
      {
        find: '~',
        replacement: path.resolve(__dirname, './src'),
      },
      // App client hook is now injected via registerWorkerClientHook in tests
    ],
  },
});
