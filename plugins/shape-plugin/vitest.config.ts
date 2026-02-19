import { defineConfig } from 'vitest/config';
import * as path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

const useForkPool = process.env.SHAPE_VITEST_POOL === 'forks';
const includeDeepTests = process.env.ENABLE_SHAPE_DEEP_TESTS === '1';
const explicitlyRequestedWflTest = process.argv.some((arg) => arg.includes('__tests__/wfl/'));
const includeWflTests = includeDeepTests || explicitlyRequestedWflTest;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Keep thread pool by default for CI stability; allow opt-in fork pool for local diagnostics.
    pool: useForkPool ? 'forks' : 'threads',
    poolOptions: useForkPool
      ? {
        forks: {
          singleFork: true,
          execArgv: ['--max-old-space-size=8192'],
        },
      }
      : {
        threads: {
          minThreads: 1,
          maxThreads: 1,
        },
      },
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    exclude: [
      'src/**/migration/**',
      ...(includeWflTests ? [] : ['src/**/__tests__/wfl/**']),
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
        replacement: path.resolve(__dirname, '../../packages/core-types/src/index.ts'),
      },
      {
        find: '@hierarchidb/core-types',
        replacement: path.resolve(__dirname, '../../packages/core-types/src/index.ts'),
      },
      {
        find: '@hierarchidb/batch-api',
        replacement: path.resolve(__dirname, '../../packages/batch-api/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-worker-client',
        replacement: path.resolve(__dirname, '../../packages/ui/worker-client/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-batch',
        replacement: path.resolve(__dirname, '../../packages/ui/batch/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-batch-progress',
        replacement: path.resolve(__dirname, '../../packages/ui/batch/src/index.ts'),
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
        find: '@hierarchidb/auth',
        replacement: path.resolve(__dirname, './src/headless/mocks/auth.ts'),
      },
      {
        find: '@hierarchidb/resolver-store',
        replacement: path.resolve(
          __dirname,
          '../../packages/resolver-store/src/index.ts',
        ),
      },
      {
        find: '@hierarchidb/location-store',
        replacement: path.resolve(__dirname, '../../packages/location-store/src/index.ts'),
      },
      {
        find: '@hierarchidb/download',
        replacement: path.resolve(__dirname, '../../packages/download/src/index.ts'),
      },
      {
        find: '@hierarchidb/shape-store',
        replacement: path.resolve(__dirname, '../../packages/shape-store/src/index.ts'),
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
      // App client hook is now injected via registerWorkerClientHook in tests
    ],
  },
  plugins: [tsconfigPaths()],
});
