import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    root: __dirname,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@hierarchidb/download': path.resolve(__dirname, '../download/src/index.ts'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/src/index.ts'),
    },
  },
});
