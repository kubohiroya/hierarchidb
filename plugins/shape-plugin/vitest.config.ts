import { defineConfig } from 'vitest/config';
import * as path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

const useForkPool = process.env.SHAPE_VITEST_POOL === 'forks';
const includeDeepTests = process.env.ENABLE_SHAPE_DEEP_TESTS === '1';
const explicitlyRequestedWflTest = process.argv.some((arg) => arg.includes('__tests__/wfl/'));
const includeWflTests = includeDeepTests || explicitlyRequestedWflTest;
const explicitlyRequestedIntegrationTest = process.argv.some((arg) => arg.includes('__tests__/integration/'));
const includeIntegrationTests = includeDeepTests || explicitlyRequestedIntegrationTest;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Direct Vitest runs use threads; the package test script opts into isolated forks.
    pool: useForkPool ? 'forks' : 'threads',
    maxWorkers: 1,
    minWorkers: 1,
    ...(useForkPool
      ? {
        execArgv: ['--max-old-space-size=8192'],
      }
      : {}),
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    exclude: [
      'src/**/migration/**',
      ...(includeWflTests ? [] : ['src/**/__tests__/wfl/**']),
      ...(includeIntegrationTests ? [] : ['src/**/__tests__/integration/**']),
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
      { find: '~/i18n/index', replacement: path.resolve(__dirname, '../../packages/ui/i18n/src/i18n/index.ts') },
      {
        find: '~/debug/persistentDebugLog',
        replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/debug/persistentDebugLog.ts'),
      },
      {
        find: '~/utils/env',
        replacement: path.resolve(__dirname, '../../packages/ui/i18n/src/utils/env.ts'),
      },
      {
        find: '~/transform/topojsonGrid.js',
        replacement: path.resolve(
          __dirname,
          '../../packages/vt-orchestrator/src/transform/topojsonGrid.ts',
        ),
      },
      {
        find: '~/transform/topojsonRuntimeAdapter.js',
        replacement: path.resolve(
          __dirname,
          '../../packages/vt-orchestrator/src/transform/topojsonRuntimeAdapter.ts',
        ),
      },
      {
        find: '~/configTypes',
        replacement: path.resolve(__dirname, '../../packages/gis-sdk/src/configTypes.ts'),
      },
      {
        find: '~/geometryEngineUtils',
        replacement: path.resolve(__dirname, '../../packages/gis-sdk/src/geometryEngineUtils.ts'),
      },
      {
        find: /^~\/task\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/task/$1'),
      },
      { find: /^~\/contexts$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/contexts') },
      { find: /^~\/types\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/types/$1') },
      { find: /^~\/types$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/types') },
      { find: /^~\/tiles\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/tiles/$1') },
      { find: /^~\/tiles$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/tiles') },
      { find: /^~\/transform\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/transform/$1') },
      { find: /^~\/transform$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/transform') },
      { find: /^~\/compareTaskOrder\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/compareTaskOrder/$1') },
      { find: /^~\/compareTaskOrder$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/compareTaskOrder.ts') },
      { find: /^~\/vt\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/vt/$1') },
      { find: /^~\/vt$/, replacement: path.resolve(__dirname, '../../packages/vt-orchestrator/src/vt') },
      { find: /^~\/hooks\/useLRUPanes$/, replacement: path.resolve(__dirname, '../../packages/ui/lru-splitview/src/hooks/useLRUPanes.ts') },
      { find: /^~\/types\/LRUSplitView$/, replacement: path.resolve(__dirname, '../../packages/ui/lru-splitview/src/types/LRUSplitView.ts') },
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: '~', replacement: path.resolve(__dirname, 'src') },
      {
        find: '@hierarchidb/core',
        replacement: path.resolve(__dirname, '../../packages/core-types/src/index.ts'),
      },
      {
        find: '@hierarchidb/core-types',
        replacement: path.resolve(__dirname, '../../packages/core-types/src/index.ts'),
      },
      {
        find: '@hierarchidb/build-api',
        replacement: path.resolve(__dirname, '../../packages/build-api/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-worker-client',
        replacement: path.resolve(__dirname, '../../packages/ui/worker-client/dist/index.js'),
      },
      {
        find: '@hierarchidb/ui-build-sessions',
        replacement: path.resolve(__dirname, '../../packages/ui/build-sessions/dist/index.js'),
      },
      // Deep import subpaths must be listed before the bare package alias
      {
        find: '@hierarchidb/ui-build-progress/build-session',
        replacement: path.resolve(__dirname, '../../packages/ui/build-progress/dist/build-session/index.js'),
      },
      {
        find: '@hierarchidb/ui-build-progress/build-status',
        replacement: path.resolve(__dirname, '../../packages/ui/build-progress/dist/build-status/index.js'),
      },
      {
        find: '@hierarchidb/ui-build-progress/build-stage',
        replacement: path.resolve(__dirname, '../../packages/ui/build-progress/dist/build-stage/index.js'),
      },
      {
        find: '@hierarchidb/ui-build-progress',
        replacement: path.resolve(__dirname, '../../packages/ui/build-progress/dist/index.js'),
      },
      {
        find: '@hierarchidb/ui-worker-provider',
        replacement: path.resolve(__dirname, '../../packages/ui/worker-provider/dist/index.js'),
      },
      {
        // Point to dist so runtime-worker's internal ~/... aliases don't bleed into shape-plugin's resolver.
        find: '@hierarchidb/runtime-worker',
        replacement: path.resolve(__dirname, '../../packages/runtime-worker/dist/index.js'),
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
        replacement: path.resolve(__dirname, '../../packages/download/dist/index.js'),
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
