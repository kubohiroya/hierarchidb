import { defineConfig } from 'vitest/config';
import path from 'path';
import {
  deriveNodeTypePluginAliases,
  discoverNodeTypePlugins,
} from './packages/tools/plugin-registry-utils/dist/index.js';

const nodeTypePlugins = discoverNodeTypePlugins({ rootDir: __dirname });
const nodeTypeAliasEntries = deriveNodeTypePluginAliases(nodeTypePlugins, {
  subpaths: ['root', 'ui', 'services', 'database', 'shared'],
});

const nodeTypeAliases = Object.fromEntries(
  nodeTypeAliasEntries.map(({ find, replacement }) => [find, replacement]),
);

const nodeTypeSrcAliases = Object.fromEntries(
  nodeTypeAliasEntries
    .filter(({ subpath }) => subpath === 'root')
    .map(({ find, replacement }) => [`${find}/src`, path.dirname(replacement)]),
);


// Root Vitest config orchestrates per-package projects so each package's
// own aliases (e.g. "~") are honored. We also exclude Playwright e2e.
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
      '**/build/**',
      '**/storybook-static/**',
      '**/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: [
        'app/**/*.{ts,tsx}',
        'packages/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/*.stories.{ts,tsx}',
        '**/dist/**',
        '**/build/**',
        '**/storybook-static/**',
        '**/e2e/**',
        '**/references/**',
      ],
      thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 },
    },
    // Delegate to package-level configs
    projects: [
      './packages/backend/bff',
      './packages/common/api',
      './packages/common/types',
      './packages/plugins/base-plugin',
      './packages/plugins/basemap-plugin',
      './packages/plugins/folder-plugin',
      './packages/plugins/location-plugin',
      './packages/plugins/resolver-plugin',
      './packages/plugins/route-plugin',
      './packages/plugins/shape-plugin',
      './packages/plugins/spreadsheet-plugin',
      './packages/plugins/styler-plugin',
      './packages/runtime-ui/plugin-dialog',
      './packages/runtime-worker/worker-bootstrap',
      './packages/runtime-worker/worker',
      './packages/tools/vite-plugin-package-reader',
      './packages/ui/auth',
      './packages/ui/core',
      './packages/ui/dialog',
    ],
  },
  resolve: {
    alias: {
      // Map frequently referenced workspace packages to source to avoid prebuilding
      '@hierarchidb/ui-dialog': path.resolve(__dirname, './packages/ui/dialog/src/index.ts'),
      '@hierarchidb/runtime-ui-plugin-dialog': path.resolve(__dirname, './packages/runtime-ui/plugin-dialog/src/index.ts'),
      '@hierarchidb/runtime-worker-bootstrap': path.resolve(__dirname, './packages/runtime-worker/worker-bootstrap/src/index.ts'),
      '@hierarchidb/common-api': path.resolve(__dirname, './packages/common/api/src/index.ts'),
      '@hierarchidb/ui-core': path.resolve(__dirname, './packages/ui/core/src/index.ts'),
      '@hierarchidb/util': path.resolve(__dirname, './packages/util/src/index.ts'),
      // Node-type plugin aliases are generated automatically (root/src/services/database/shared)
      ...nodeTypeAliases,
      ...nodeTypeSrcAliases,
      // Important: don't set a global "~" alias here to avoid conflicts across packages.
    },
  },
});
