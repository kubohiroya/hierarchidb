import { defineConfig } from 'vitest/config';
import path from 'path';

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
      './packages/node-type/base-plugin',
      './packages/node-type/basemap-plugin',
      './packages/node-type/folder-plugin',
      './packages/node-type/location-plugin',
      './packages/node-type/resolver-plugin',
      './packages/node-type/route-plugin',
      './packages/node-type/shape-plugin',
      './packages/node-type/spreadsheet-plugin',
      './packages/node-type/styler-plugin',
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
      '@hierarchidb/folder-plugin': path.resolve(__dirname, './packages/node-type/folder-plugin/src/index.ts'),
      '@hierarchidb/folder-plugin/src': path.resolve(__dirname, './packages/node-type/folder-plugin/src'),
      '@hierarchidb/linker-plugin': path.resolve(__dirname, './packages/node-type/linker-plugin/src/index.ts'),
      '@hierarchidb/linker-plugin/src': path.resolve(__dirname, './packages/node-type/linker-plugin/src'),
      '@hierarchidb/basemap-plugin': path.resolve(__dirname, './packages/node-type/basemap-plugin/src/index.ts'),
      '@hierarchidb/basemap-plugin/src': path.resolve(__dirname, './packages/node-type/basemap-plugin/src'),
      '@hierarchidb/styler-plugin': path.resolve(__dirname, './packages/node-type/styler-plugin/src/index.ts'),
      '@hierarchidb/styler-plugin/src': path.resolve(__dirname, './packages/node-type/styler-plugin/src'),
      '@hierarchidb/resolver-plugin': path.resolve(__dirname, './packages/node-type/resolver-plugin/src/index.ts'),
      '@hierarchidb/resolver-plugin/src': path.resolve(__dirname, './packages/node-type/resolver-plugin/src'),
      '@hierarchidb/route-plugin': path.resolve(__dirname, './packages/node-type/route-plugin/src/index.ts'),
      '@hierarchidb/route-plugin/src': path.resolve(__dirname, './packages/node-type/route-plugin/src'),
      '@hierarchidb/location-plugin': path.resolve(__dirname, './packages/node-type/location-plugin/src/index.ts'),
      '@hierarchidb/location-plugin/src': path.resolve(__dirname, './packages/node-type/location-plugin/src'),
      '@hierarchidb/shape-plugin': path.resolve(__dirname, './packages/node-type/shape-plugin/src/index.ts'),
      '@hierarchidb/shape-plugin/src': path.resolve(__dirname, './packages/node-type/shape-plugin/src'),
      '@hierarchidb/spreadsheet-plugin': path.resolve(__dirname, './packages/node-type/spreadsheet-plugin/src/index.ts'),
      '@hierarchidb/spreadsheet-plugin/src': path.resolve(__dirname, './packages/node-type/spreadsheet-plugin/src'),
      // Important: don't set a global "~" alias here to avoid conflicts across packages.
    },
  },
});
