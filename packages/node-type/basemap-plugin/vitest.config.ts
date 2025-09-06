import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/**/*.js',
    ],
  },
  resolve: {
    alias: {
      '~': 'src/*', //path.resolve(__dirname, './src')
      '@hierarchidb/util': path.resolve(__dirname, '../../util/src/index.ts'),
      // Resolve workspace package to source during tests to avoid prebuild requirement
      '@hierarchidb/folder-plugin': path.resolve(__dirname, '../folder-plugin/src/index.ts'),
    },
  },
});
