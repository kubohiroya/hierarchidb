import * as path from 'path';
import { defineConfig } from 'vitest/config';

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
      // Resolve ~/... imports inside download/src (e.g. ~/helpers/resolveNetworkUrl)
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: '~', replacement: path.resolve(__dirname, 'src') },
      { find: '@hierarchidb/auth', replacement: path.resolve(__dirname, '../auth/src/index.ts') },
    ],
  },
});
