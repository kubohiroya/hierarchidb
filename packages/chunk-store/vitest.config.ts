import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.ts')],
    root: __dirname,
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: [
      // Resolve ~/... imports inside download/src when traversed via @hierarchidb/download src alias
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, '../download/src/$1') },
      { find: '~', replacement: path.resolve(__dirname, '../download/src') },
      { find: '@hierarchidb/download', replacement: path.resolve(__dirname, '../download/src/index.ts') },
      { find: '@hierarchidb/util', replacement: path.resolve(__dirname, '../util/src/index.ts') },
      { find: '@hierarchidb/core-types', replacement: path.resolve(__dirname, '../core-types/src/index.ts') },
    ],
  },
});
