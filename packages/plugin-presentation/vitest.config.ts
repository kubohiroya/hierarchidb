import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    passWithNoTests: false,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@hierarchidb/plugin-presentation': path.resolve(__dirname, './src/index.ts'),
    },
  },
});
