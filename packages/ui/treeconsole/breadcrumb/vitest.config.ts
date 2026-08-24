import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/dist/**', '**/node_modules/**'],
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
  },
});
