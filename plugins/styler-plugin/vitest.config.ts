/// <reference types="vitest" />

import * as path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');
const basePluginEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/common/__tests__/setup.ts'],
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@hierarchidb/spreadsheet-plugin': path.resolve(
        __dirname,
        './src/common/__tests__/mocks/spreadsheet-plugin-real.ts'
      ),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/ui-tabular': path.resolve(
        workspaceRoot,
        'packages/ui/tabular-extract/src/index.ts'
      ),
      '@hierarchidb/ui-i18n': path.resolve(workspaceRoot, 'packages/ui/i18n/src/index.ts'),
      '@hierarchidb/tabular-store': path.resolve(
        workspaceRoot,
        'packages/tabular-store/src/index.ts'
      ),
      '@hierarchidb/styler-store': path.resolve(
        workspaceRoot,
        'packages/styler-store/src/index.ts'
      ),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
    },
  },
});
