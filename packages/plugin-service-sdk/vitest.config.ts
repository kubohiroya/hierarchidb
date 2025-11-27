import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
    environment: 'node',
  },
});
