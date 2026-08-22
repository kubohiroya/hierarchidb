import * as path from 'path';
import { defineConfig } from 'vitest/config';

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
