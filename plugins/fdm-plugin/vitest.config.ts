import path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');
const pluginBaseSrc = path.resolve(workspaceRoot, 'packages/plugin-base/src');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: [
      {
        find: '@hierarchidb/fdm-api',
        replacement: path.resolve(workspaceRoot, 'packages/fdm-api/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-ide-gsm-connection',
        replacement: path.resolve(workspaceRoot, 'packages/ui/ide-gsm-connection/src/index.ts'),
      },
      {
        find: '@hierarchidb/ui-external-service-connection',
        replacement: path.resolve(
          workspaceRoot,
          'packages/ui/external-service-connection/src/index.ts'
        ),
      },
      {
        find: '@hierarchidb/ui-external-service-health',
        replacement: path.resolve(
          workspaceRoot,
          'packages/ui/external-service-health/src/index.ts'
        ),
      },
      {
        find: '@hierarchidb/plugin-base',
        replacement: path.resolve(pluginBaseSrc, 'index.ts'),
      },
      { find: '~', replacement: pluginBaseSrc },
    ],
  },
});
