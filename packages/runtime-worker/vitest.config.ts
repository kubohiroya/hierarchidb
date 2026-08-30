import * as path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');
const src = (target: string): string => path.resolve(workspaceRoot, target);
const alias = (find: string, target: string): { find: string; replacement: string } => ({
  find,
  replacement: src(target),
});

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
    alias: [
      alias(
        '@hierarchidb/yaml-api/inverse-migration',
        'packages/yaml-api/src/inverse-migration/index.ts'
      ),
      alias('@hierarchidb/yaml-api/migration', 'packages/yaml-api/src/migration/index.ts'),
      alias('@hierarchidb/yaml-api/validation', 'packages/yaml-api/src/validation/index.ts'),
      alias(
        '@hierarchidb/staged-folder-action/map-image-capture-browser-host',
        'packages/staged-folder-action/src/createMapImageCaptureBrowserActionRunner.ts'
      ),
      alias(
        '@hierarchidb/staged-folder-action/export-file-host',
        'packages/staged-folder-action/src/createExportFileActionRunner.ts'
      ),
      alias(
        '@hierarchidb/staged-folder-action/cli',
        'packages/staged-folder-action/src/runStagedFolderActionCli.ts'
      ),
      alias('@hierarchidb/core-types', 'packages/core-types/src/index.ts'),
      alias('@hierarchidb/gis-sdk', 'packages/gis-sdk/src/index.ts'),
      alias('@hierarchidb/gen-iso3166-2/browser', 'packages/tools/gen-iso3166-2/src/browser.ts'),
      alias('@hierarchidb/gen-iso3166-2', 'packages/tools/gen-iso3166-2/src/index.ts'),
      alias('@hierarchidb/ide-gsm-client', 'packages/ide-gsm-client/src/index.ts'),
      alias('@hierarchidb/location-api', 'packages/location-api/src/index.ts'),
      alias('@hierarchidb/route-api', 'packages/route-api/src/index.ts'),
      alias('@hierarchidb/build-api', '@hierarchidb/build-api/src/index.ts'),
      alias('@hierarchidb/tree-api', 'packages/tree-api/src/index.ts'),
      alias('@hierarchidb/worker-api', 'packages/worker-api/src/index.ts'),
      alias('@hierarchidb/auth', 'packages/auth/src/index.ts'),
      alias('@hierarchidb/download', 'packages/download/src/index.ts'),
      alias('@hierarchidb/import-export', 'packages/import-export/src/index.ts'),
      alias('@hierarchidb/import-export-api', 'packages/import-export-api/src/index.ts'),
      alias('@hierarchidb/map-source', 'packages/map-source/src/index.ts'),
      alias('@hierarchidb/tabular-source', 'packages/tabular-source/src/index.ts'),
      alias('@hierarchidb/tabular-store', 'packages/tabular-store/src/index.ts'),
      alias('@hierarchidb/route-store', 'packages/route-store/src/index.ts'),
      alias('@hierarchidb/shape-api', 'packages/shape-api/src/index.ts'),
      alias('@hierarchidb/shape-store', 'packages/shape-store/src/index.ts'),
      alias('@hierarchidb/chunk-store', 'packages/chunk-store/src/index.ts'),
      alias('@hierarchidb/location-store', 'packages/location-store/src/index.ts'),
      alias('@hierarchidb/spreadsheet-store', 'packages/spreadsheet-store/src/index.ts'),
      alias('@hierarchidb/staged-folder-action', 'packages/staged-folder-action/src/index.ts'),
      alias('@hierarchidb/style-api', 'packages/style-api/src/index.ts'),
      alias('@hierarchidb/styler-store', 'packages/styler-store/src/index.ts'),
      alias('@hierarchidb/tag-api', 'packages/tag-api/src/index.ts'),
      alias('@hierarchidb/tag', 'packages/tag/src/index.ts'),
      alias('@hierarchidb/util', 'packages/util/src/index.ts'),
      alias('@hierarchidb/map-adapter', 'packages/map-adapter/src/index.ts'),
      alias('@hierarchidb/tabular-source-xlsx', 'packages/tabular-source-xlsx/src/index.ts'),
      alias('@hierarchidb/vt-orchestrator', 'packages/vt-orchestrator/src/index.ts'),
      alias('@hierarchidb/vectortile-store', 'packages/vectortile-store/src/index.ts'),
      alias('@hierarchidb/yaml-api', 'packages/yaml-api/src/index.ts'),
    ],
  },
  plugins: [tsconfigPaths()],
});
