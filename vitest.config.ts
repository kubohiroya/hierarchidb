import { defineConfig, defineProject } from 'vitest/config';
import * as path from 'path';
import { collectAliasEntries } from './app/vite-plugins/vite-plugin-hierarchidb-plugin-alias/src/alias';

const nodeTypeAliasEntries = collectAliasEntries(__dirname, [
  'root',
  'ui',
  'worker',
  'database',
  'common',
]);

const nodeTypeAliases = Object.fromEntries(
  nodeTypeAliasEntries.map(({ find, replacement }) => [find, replacement])
);

const nodeTypeSrcAliases = Object.fromEntries(
  nodeTypeAliasEntries
    .filter(({ kind }) => kind === 'root')
    .map(({ find, replacement }) => [`${find}/src`, path.dirname(replacement)])
);

const packagesProject = defineProject({
  // name: 'packages',
  test: {
    root: path.resolve(__dirname, 'packages'),
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    exclude: ['**/node_modules/**', 'vt-orchestrator/**', '**/@hierarchidb/vt-orchestrator/**'],
    //passWithNoTests: true,
  },
});

const vtOrchestratorProject = defineProject({
  // name: 'vt-orchestrator',
  test: {
    root: path.resolve(__dirname, 'packages/vt-orchestrator'),
    environment: 'node',
    setupFiles: [],
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.unit.test.ts',
      'src/**/__tests__/**/*.ts',
    ],
    //passWithNoTests: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'packages/vt-orchestrator/src'),
      '@hierarchidb/core-types': path.resolve(__dirname, 'packages/core-types/dist/index.js'),
      '@hierarchidb/build-api': path.resolve(__dirname, 'packages/build-api/dist/index.js'),
      '@hierarchidb/gis-sdk': path.resolve(__dirname, 'packages/gis-sdk/dist/index.js'),
      '@hierarchidb/shape-api': path.resolve(__dirname, 'packages/shape-api/dist/index.js'),
      '@hierarchidb/chunk-store': path.resolve(__dirname, 'packages/chunk-store/dist/index.js'),
    },
  },
});

// Root Vitest config orchestrates per-package projects so each package's
// own aliases (e.g. "~") are honored. We also exclude Playwright e2e.
const projectRoots = [
  'packages/backend/bff',
  'packages/runtime-worker',
  'packages/plugin-ui-host',
  'packages/plugin-ui-sdk',
  'packages/plugin-presentation',
  'packages/ui/icon',
  'packages/util',
  'packages/testing/plugin-dialog-mocks',
  'packages/ui/auth',
  'packages/ui/dialog',
  'packages/ui/treeconsole/base',
  'packages/ui/treeconsole/treetable',
  'plugins/basemap-plugin',
  'plugins/folder-plugin',
  'plugins/location-plugin',
  'plugins/resolver-plugin',
  'plugins/route-plugin',
  'plugins/shape-plugin',
  'plugins/spreadsheet-plugin',
  'plugins/styler-plugin',
];

const resolvedProjects = projectRoots.map((projectPath) => path.resolve(__dirname, projectPath));

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
    root: process.cwd(),
    passWithNoTests: true,
    // Never pick up Playwright e2e in Vitest runs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/stage/**',
      '**/storybook-static/**',
      '**/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['app/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/*.stories.{ts,tsx}',
        '**/dist/**',
        '**/stage/**',
        '**/storybook-static/**',
        '**/e2e/**',
        '**/references/**',
      ],
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
    // Delegate to package-level configs
    projects: [packagesProject, ...resolvedProjects, vtOrchestratorProject],
  },
  resolve: {
    alias: {
      // Map frequently referenced workspace packages to source to avoid prebuilding
      '@hierarchidb/ui-dialog': path.resolve(__dirname, './packages/ui/dialog/src/index.ts'),
      '@hierarchidb/runtime-ui-plugin-dialog': path.resolve(
        __dirname,
        './packages/runtime-worker-ui/plugin-dialog/src/index.ts'
      ),
      '@hierarchidb/ui-worker-client': path.resolve(
        __dirname,
        './packages/runtime-worker/client/src/index.ts'
      ),
      '@hierarchidb/build-api': path.resolve(__dirname, './packages//src/index.ts'),
      '@hierarchidb/ui-core': path.resolve(__dirname, './packages/ui/core/src/index.ts'),
      '@hierarchidb/util': path.resolve(__dirname, './packages/util/src/index.ts'),
      '@hierarchidb/ui-treeconsole-toolbar': path.resolve(
        __dirname,
        './packages/ui/treeconsole/toolbar/src/index.ts'
      ),
      // Node-type plugin aliases are generated automatically (root/src/services/database/shared)
      ...nodeTypeAliases,
      ...nodeTypeSrcAliases,
      // Important: don't set a global "~" alias here to avoid conflicts across packages.
    },
  },
});
