import { defineConfig } from 'vitest/config';
import path from 'path';
const RUN_ROUTE_TESTS = process.env.ROUTE_TESTS === '1';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    include: RUN_ROUTE_TESTS ? [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ] : [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(RUN_ROUTE_TESTS ? [] : ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}']),
    ],
  },
});
