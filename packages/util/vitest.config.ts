import { resolve } from 'path';
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    root: resolve(__dirname),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    passWithNoTests: false,
  },
});
