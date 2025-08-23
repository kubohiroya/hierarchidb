import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@hierarchidb/core': path.resolve(__dirname, './src'),
    },
  },
});