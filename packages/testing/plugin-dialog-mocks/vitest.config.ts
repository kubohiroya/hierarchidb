import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [],
    passWithNoTests: true,
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@hierarchidb/testing-plugin-dialog-mocks': path.resolve(__dirname, './src/index.ts'),
      '@hierarchidb/testing-plugin-dialog-mocks/setupPluginWorkerMock': path.resolve(
        __dirname,
        './src/setupPluginWorkerMock.ts'
      ),
      '@hierarchidb/testing-plugin-dialog-mocks/mocks': path.resolve(
        __dirname,
        './src/mocks/index.ts'
      ),
      '@hierarchidb/testing-plugin-dialog-mocks/stubs': path.resolve(
        __dirname,
        './src/stubs/index.ts'
      ),
    },
  },
});
