import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    root: __dirname,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './packages/ui/core/src'),
      '@hierarchidb/ui-core': path.resolve(__dirname, './packages/ui/core/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, './packages/common/api/src'),
      '@hierarchidb/common-core': path.resolve(__dirname, './packages/common/core/src'),
      '@hierarchidb/worker': path.resolve(__dirname, './packages/runtime/worker/src'),
    },
  },
});
