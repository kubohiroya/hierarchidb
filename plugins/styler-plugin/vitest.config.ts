/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import * as path from 'path';

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
      // Cross-plugin import resolution
      '../../spreadsheet/src/services/SpreadsheetTabularApiDriver': path.resolve(__dirname, '../spreadsheet-plugin/src/services/SpreadsheetTabularApiDriver'),
      '@hierarchidb/spreadsheet-plugin': path.resolve(
        __dirname,
        '../spreadsheet-plugin/src/index.ts'
      ),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/ui-tabular': path.resolve(
        workspaceRoot,
        'packages/ui/tabular-extract/src/index.ts'
      ),
      '@hierarchidb/ui-i18n': path.resolve(
        workspaceRoot,
        'packages/ui/i18n/src/index.ts'
      ),
      '@hierarchidb/util': path.resolve(workspaceRoot, 'packages/util/src/index.ts'),
    },
  },
});
