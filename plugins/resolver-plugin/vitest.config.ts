import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'path';

const entityServiceDistEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/dist/index.js');
const entityServiceSrcEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/src/index.ts');
const entityServiceEntry = fs.existsSync(entityServiceDistEntry) ? entityServiceDistEntry : entityServiceSrcEntry;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/ui/components/__tests__/setup.ts'],
    pool: 'threads',
    maxThreads: 1,
    minThreads: 1,
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
      '~': path.resolve(__dirname, 'src'),
      '@hierarchidb/util': path.resolve(__dirname, '../../packages/util/src/index.ts'),
      '@hierarchidb/plugin-entity-service': entityServiceEntry,
      '@hierarchidb/download': path.resolve(
        __dirname,
        '../../packages/feature/download/src/index.ts',
      ),
      // Needed when ui/core (dist) imports runtime-client
      '@hierarchidb/runtime-client': path.resolve(
        __dirname,
        '../../runtime-worker/client/src/index.ts',
      ),
    },
  },
});
