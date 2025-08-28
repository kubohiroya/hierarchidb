import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 3000, // 3 seconds for faster feedback
  },
  resolve: {
    alias: {
      '@hierarchidb/core': path.resolve(__dirname, '../../common/core/src'),
      '@hierarchidb/common-core': path.resolve(__dirname, '../../common/core/src'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/src'),
      '@hierarchidb/runtime-worker': path.resolve(__dirname, '../../runtime/worker/src'),
      '@hierarchidb/runtime-datasource': path.resolve(__dirname, '../../runtime/datasource/src'),
      '@hierarchidb/ui-lru-splitview': path.resolve(__dirname, '../../ui/lru-splitview/src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
});