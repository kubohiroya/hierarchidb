import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, '../../../vitest.setup.ts')],
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // Use mock WorkerAPI for integration-like tests
      '@hierarchidb/runtime-worker-worker/WorkerAPIImpl': path.resolve(
        __dirname,
        './src/tests/mocks/WorkerAPIImpl.ts',
      ),
    },
  },
});

