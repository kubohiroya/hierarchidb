import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './packages/ui-core/src'),
      '@hierarchidb/ui-core': path.resolve(__dirname, './packages/ui-core/src'),
    },
  },
});
