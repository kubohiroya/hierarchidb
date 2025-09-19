/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
  },
  resolve: {
    alias: {
      // Cross-plugin import resolution
      '../../spreadsheet/src/services/SpreadsheetCSVApiDriver': path.resolve(__dirname, '../spreadsheet-plugin/src/services/SpreadsheetCSVApiDriver.ts'),
      '@hierarchidb/node-type-spreadsheet-plugin': path.resolve(__dirname, './src/__tests__/mocks/spreadsheet-plugin.ts'),
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/ui-csv-extract': path.resolve(__dirname, '../../ui/csv-extract/dist/index.js'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/dist/index.js'),
    },
  },
});
