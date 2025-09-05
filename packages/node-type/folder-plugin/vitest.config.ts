import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    globals: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@hierarchidb/ui-dialog': path.resolve(__dirname, '../../ui/dialog/src/index.ts'),
      '@hierarchidb/runtime-worker': path.resolve(__dirname, './src/__tests__/__mocks__/store-registry.ts'),
      '@hierarchidb/util': path.resolve(__dirname, '../../util/src/index.ts'),
    },
  },
});
