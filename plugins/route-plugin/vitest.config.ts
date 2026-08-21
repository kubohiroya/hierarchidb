import * as path from 'path';
import { defineConfig } from 'vitest/config';

const RUN_ROUTE_TESTS = process.env.ROUTE_TESTS === '1';

const basePluginEntry = path.resolve(__dirname, '../../packages/plugin-base/src/index.ts');

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.ts')],
    pool: 'threads',
    include: RUN_ROUTE_TESTS
      ? ['src/**/*.unit.test.ts', 'src/**/*.unit.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx']
      : [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(RUN_ROUTE_TESTS ? [] : ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}']),
    ],
  },
  resolve: {
    alias: {
      '~/i18n/index': path.resolve(__dirname, '../../packages/ui/i18n/src/i18n/index.ts'),
      '~/utils/env': path.resolve(__dirname, '../../packages/ui/i18n/src/utils/env.ts'),
      '~/registry/HostProfileRegistry': path.resolve(
        __dirname,
        '../../packages/plugin-base/src/registry/HostProfileRegistry.ts'
      ),
      '~/registry/PluginStepRegistry': path.resolve(
        __dirname,
        '../../packages/plugin-base/src/registry/PluginStepRegistry.ts'
      ),
      '~/common/config/buildConfig': path.resolve(__dirname, 'src/common/config/buildConfig.ts'),
      '@hierarchidb/plugin-base': basePluginEntry,
      '@hierarchidb/ui-i18n': path.resolve(__dirname, '../../packages/ui/i18n/src/index.ts'),
      '~': path.resolve(__dirname, 'src'),
    },
  },
});
