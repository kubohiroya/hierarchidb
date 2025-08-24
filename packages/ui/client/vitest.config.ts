import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../api/src'),
      '@hierarchidb/common-core': path.resolve(__dirname, '../core/src'),
      '@hierarchidb/ui-core': path.resolve(__dirname, '../ui-core/src'),
    },
  },
});