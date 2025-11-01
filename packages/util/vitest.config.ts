import { defineProject } from 'vitest/config';
import { resolve } from 'path';

export default defineProject({
  test: {
    root: resolve(__dirname),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    passWithNoTests: false,
  },
});
