import { defineConfig } from 'vitest/config';
import * as fs from 'node:fs';
import * as path from 'path';

const entityServiceDistEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/dist/index.js');
const entityServiceSrcEntry = path.resolve(__dirname, '../../packages/plugin-entity-service/src/index.ts');
const entityServiceEntry = fs.existsSync(entityServiceDistEntry) ? entityServiceDistEntry : entityServiceSrcEntry;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
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
      '@hierarchidb/plugin-entity-service': entityServiceEntry,
      '@hierarchidb/download': path.resolve(
        __dirname,
        '../../packages/feature/download/src/index.ts',
      ),
    },
  },
});
