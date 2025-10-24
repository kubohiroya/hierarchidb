import * as path from 'path';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    root: rootDir,
    setupFiles: [path.resolve(rootDir, '../vitest.setup.ts')],
    //coverage: {
    //  reporter: ['text'],
    //},
  },
  resolve: {
    alias: {
      '~': path.resolve(rootDir, 'src'),
      '#app': path.resolve(rootDir, 'src'),
      'node-fetch': path.resolve(rootDir, 'src/virtual/node-fetch.ts'),
    },
  },
});
