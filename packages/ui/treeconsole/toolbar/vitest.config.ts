import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
});
