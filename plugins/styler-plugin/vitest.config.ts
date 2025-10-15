/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'path';

const basePluginDistEntry = path.resolve(__dirname, '../base-plugin/dist/index.ts');
const basePluginSrcEntry = path.resolve(__dirname, '../base-plugin/src/index.ts');
const basePluginEntry = fs.existsSync(basePluginDistEntry) ? basePluginDistEntry : basePluginSrcEntry;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'threads',
  },
  resolve: {
    alias: {
      // Cross-plugin import resolution
      '../../spreadsheet/src/services/SpreadsheetCSVApiDriver': path.resolve(__dirname, '../spreadsheet-plugin/src/services/SpreadsheetCSVApiDriver.ts'),
      '@hierarchidb/spreadsheet-plugin': path.resolve(__dirname, './src/__tests__/mocks/spreadsheet-plugin.ts'),
      '@hierarchidb/plugin-sdk': basePluginEntry,
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/ui-csv-extract': path.resolve(__dirname, '../../ui/tabular-extract/dist/index.ts'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.ts'),
    },
  },
});
