import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'path';

const entityServiceDistEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/dist/index.js');
const entityServiceSrcEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/src/index.ts');
const entityServiceEntry = fs.existsSync(entityServiceDistEntry) ? entityServiceDistEntry : entityServiceSrcEntry;

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Use threads pool to avoid child-process kill errors in sandboxed CI
    pool: 'threads',
    // maxThreads: 1,
    // minThreads: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],

    exclude: [
      'src/**/migration/**',
      'src/**/__tests__/integration/**',
      'src/services/workers/__tests__/**',
      'src/services/**/__tests__/**',
      'src/worker/**/__tests__/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
    testTimeout: 3000, // 3 seconds for faster feedback
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/*.stories.{ts,tsx}', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      // Map legacy core imports to public dist builds for tests
      '@hierarchidb/core': path.resolve(__dirname, '../../common/types/dist/index.ts'),
      '@hierarchidb/common-types': path.resolve(__dirname, '../../common/types/dist/index.ts'),
      '@hierarchidb/common-api': path.resolve(__dirname, '../../common/api/dist/index.ts'),
      '@hierarchidb/runtime-client': path.resolve(__dirname, '../../runtime/client/dist/index.ts'),
      '@hierarchidb/runtime-worker': path.resolve(__dirname, '../../runtime/worker/dist/index.ts'),
      '@hierarchidb/runtime-ui-datasource': path.resolve(__dirname, '../../runtime-ui/datasource/dist/index.ts'),
      '@hierarchidb/ui-lru-splitview': path.resolve(__dirname, '../../ui/lru-splitview/dist/index.ts'),
      '@hierarchidb/plugin-entity-service': entityServiceEntry,
      '@hierarchidb/download': path.resolve(
        __dirname,
        '../../packages/feature/download/src/index.ts',
      ),
      '~': path.resolve(__dirname, './src'),
      // App client hook is now injected via registerWorkerClientHook in tests
    },
  },
});
