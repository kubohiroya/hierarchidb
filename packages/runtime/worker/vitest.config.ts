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
      '@hierarchidb/common-core': path.resolve(__dirname, '../../common/core/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
});
