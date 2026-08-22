import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.unit.test.ts'],
  },
  resolve: {
    alias: {
      '@hierarchidb/util': resolve(__dirname, '../../util/src/index.ts'),
    },
  },
});
