import * as path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/__tests__/**/*.ts'],
    // Gate heavy suites behind env flags for a stable baseline
    //  - WORKER_E2E=1 to include *.headless.test.ts
    //  - WORKER_ENTITY_TESTS=1 to include src/entity/** tests
    //  - WORKER_ROUTING_TESTS=1 to include cp-routing*.test.ts
    exclude: (() => {
      const ex: string[] = [];
      if (process.env.WORKER_E2E !== '1') {
        ex.push('src/**/*.headless.test.ts');
        // Gate the semi-e2e draft commit test as well
        ex.push('src/__tests__/headless/commit-draft.headless.test.ts');
      }
      if (process.env.WORKER_ENTITY_TESTS !== '1') {
        ex.push('src/entity/**/__tests__/**/*.test.ts');
      }
      if (process.env.WORKER_ROUTING_TESTS !== '1') {
        ex.push('src/services/**/cp-routing-*.test.ts');
      }
      return ex;
    })(),
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@hierarchidb/core-types': path.resolve(workspaceRoot, 'packages/core-types/src/index.ts'),
      '@hierarchidb/gis-sdk': path.resolve(workspaceRoot, 'packages/gis-sdk/src/index.ts'),
      '@hierarchidb/gen-iso3166-2/browser': path.resolve(
        workspaceRoot,
        'packages/tools/gen-iso3166-2/src/browser.ts'
      ),
      '@hierarchidb/gen-iso3166-2': path.resolve(
        workspaceRoot,
        'packages/tools/gen-iso3166-2/src/index.ts'
      ),
      '@hierarchidb/ide-gsm-client': path.resolve(
        workspaceRoot,
        'packages/ide-gsm-client/src/index.ts'
      ),
      '@hierarchidb/location-api': path.resolve(
        workspaceRoot,
        'packages/location-api/src/index.ts'
      ),
      '@hierarchidb/route-api': path.resolve(workspaceRoot, 'packages/route-api/src/index.ts'),
      '@hierarchidb/build-api': path.resolve(workspaceRoot, '@hierarchidb/build-api/src/index.ts'),
      '@hierarchidb/tree-api': path.resolve(workspaceRoot, 'packages/tree-api/src/index.ts'),
      '@hierarchidb/worker-api': path.resolve(workspaceRoot, 'packages/worker-api/src/index.ts'),
      '@hierarchidb/auth': path.resolve(workspaceRoot, 'packages/auth/src/index.ts'),
      '@hierarchidb/download': path.resolve(workspaceRoot, 'packages/download/src/index.ts'),
      '@hierarchidb/import-export': path.resolve(
        workspaceRoot,
        'packages/import-export/src/index.ts'
      ),
      '@hierarchidb/import-export-api': path.resolve(
        workspaceRoot,
        'packages/import-export-api/src/index.ts'
      ),
      '@hierarchidb/map-source': path.resolve(workspaceRoot, 'packages/map-source/src/index.ts'),
      '@hierarchidb/tabular-source': path.resolve(
        workspaceRoot,
        'packages/tabular-source/src/index.ts'
      ),
      '@hierarchidb/tabular-store': path.resolve(
        workspaceRoot,
        'packages/tabular-store/src/index.ts'
      ),
      '@hierarchidb/route-store': path.resolve(workspaceRoot, 'packages/route-store/src/index.ts'),
      '@hierarchidb/shape-api': path.resolve(workspaceRoot, 'packages/shape-api/src/index.ts'),
      '@hierarchidb/shape-store': path.resolve(workspaceRoot, 'packages/shape-store/src/index.ts'),
      '@hierarchidb/chunk-store': path.resolve(workspaceRoot, 'packages/chunk-store/src/index.ts'),
      '@hierarchidb/location-store': path.resolve(
        workspaceRoot,
        'packages/location-store/src/index.ts'
      ),
      '@hierarchidb/spreadsheet-store': path.resolve(
        workspaceRoot,
        'packages/spreadsheet-store/src/index.ts'
      ),
      '@hierarchidb/staged-folder-action': path.resolve(
        workspaceRoot,
        'packages/staged-folder-action/src/index.ts'
      ),
      '@hierarchidb/style-api': path.resolve(workspaceRoot, 'packages/style-api/src/index.ts'),
      '@hierarchidb/styler-store': path.resolve(
        workspaceRoot,
        'packages/styler-store/src/index.ts'
      ),
      '@hierarchidb/tag-api': path.resolve(workspaceRoot, 'packages/tag-api/src/index.ts'),
      '@hierarchidb/tag': path.resolve(workspaceRoot, 'packages/tag/src/index.ts'),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
      '@hierarchidb/map-adapter': path.resolve(workspaceRoot, 'packages/map-adapter/src/index.ts'),
      '@hierarchidb/tabular-source-xlsx': path.resolve(
        workspaceRoot,
        'packages/tabular-source-xlsx/src/index.ts'
      ),
      '@hierarchidb/vt-orchestrator': path.resolve(
        workspaceRoot,
        'packages/vt-orchestrator/src/index.ts'
      ),
      '@hierarchidb/vectortile-store': path.resolve(
        workspaceRoot,
        'packages/vectortile-store/src/index.ts'
      ),
      '@hierarchidb/yaml-api': path.resolve(workspaceRoot, 'packages/yaml-api/src/index.ts'),
    },
  },
  plugins: [tsconfigPaths()],
});
