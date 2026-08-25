import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../../vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.unit.test.tsx'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
