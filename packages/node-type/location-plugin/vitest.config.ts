import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Avoid EPERM from child process kills in sandboxed CI
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

