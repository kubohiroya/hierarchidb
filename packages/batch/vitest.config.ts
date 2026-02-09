import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.ts')],
  },
});
