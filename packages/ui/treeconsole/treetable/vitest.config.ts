import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    // include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
  },
});
