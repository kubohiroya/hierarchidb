import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
});

