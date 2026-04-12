import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
