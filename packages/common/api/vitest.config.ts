import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../../vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@hierarchidb/common-api': path.resolve(__dirname, './src'),
      '@hierarchidb/common-core': path.resolve(__dirname, '../core/src'),
      '@hierarchidb/worker': path.resolve(__dirname, '../../runtime/worker/src'),
    },
  },
});