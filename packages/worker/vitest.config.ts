import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@hierarchidb/core': path.resolve(__dirname, '../core/src'),
      '@hierarchidb/api': path.resolve(__dirname, '../api/src'),
      '~': path.resolve(__dirname, '../core/src'),
    },
  },
});
