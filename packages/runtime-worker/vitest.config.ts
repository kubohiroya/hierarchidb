import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/__tests__/**/*.ts',
    ],
    // Gate heavy suites behind env flags for a stable baseline
    //  - WORKER_E2E=1 to include *.headless.test.ts
    //  - WORKER_ENTITY_TESTS=1 to include src/entity/** tests
    //  - WORKER_ROUTING_TESTS=1 to include cp-routing*.test.ts
    exclude: (() => {
      const ex: string[] = [];
      if (process.env.WORKER_E2E !== '1') {
        ex.push('src/**/*.headless.test.ts');
        // Gate the semi-e2e working copy commit test as well
        ex.push('src/__tests__/headless/commit-draft.headless.test.ts');
      }
      if (process.env.WORKER_ENTITY_TESTS !== '1') {
        ex.push('src/entity/**/__tests__/**/*.test.ts');
      }
      if (process.env.WORKER_ROUTING_TESTS !== '1') {
        ex.push('src/services/**/cp-routing-*.test.ts');
      }
      return ex;
    })(),
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/dist/**'],
    },
  },
  plugins: [tsconfigPaths()],
});
