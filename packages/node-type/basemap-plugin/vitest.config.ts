import { defineConfig } from 'vitest/config';
//import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '~': 'src/*', //path.resolve(__dirname, './src')
    },
  },
});
