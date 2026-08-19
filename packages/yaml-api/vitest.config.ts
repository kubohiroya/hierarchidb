import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.ts', 'src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@hierarchidb/core-types': path.resolve(__dirname, '../core-types/src/index.ts'),
    },
  },
});
