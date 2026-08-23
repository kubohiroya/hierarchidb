import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/__tests__/**/*.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@hierarchidb/core-types': path.resolve(__dirname, '../core-types/src/index.ts'),
      '@hierarchidb/route-api': path.resolve(__dirname, '../route-api/src/index.ts'),
      '@hierarchidb/route-store': path.resolve(__dirname, '../route-store/src/index.ts'),
      '@hierarchidb/util': path.resolve(__dirname, '../util/src/index.ts'),
    },
  },
});
