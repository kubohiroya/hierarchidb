/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      // Cross-plugin import resolution
      '../../spreadsheet/src/services/SpreadsheetCSVApiDriver': path.resolve(__dirname, '../spreadsheet-plugin/src/services/SpreadsheetCSVApiDriver.ts'),
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/ui-csv-extract': path.resolve(__dirname, '../../ui/csv-extract/src/index.ts'),
    },
  },
})