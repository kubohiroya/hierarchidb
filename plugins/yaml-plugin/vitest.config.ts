import path from 'path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(__dirname, '../..');
const pluginBaseSrc = path.resolve(workspaceRoot, 'packages/plugin-base/src');

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    },
    resolve: {
        alias: [
            // workspace package aliases (resolved to source for test speed)
            {
                find: '@hierarchidb/yaml-api/validation',
                replacement: path.resolve(
                    workspaceRoot,
                    'packages/yaml-api/src/validation/index.ts'
                ),
            },
            {
                find: '@hierarchidb/yaml-api',
                replacement: path.resolve(workspaceRoot, 'packages/yaml-api/src/index.ts'),
            },
            {
                find: '@hierarchidb/yaml-store',
                replacement: path.resolve(workspaceRoot, 'packages/yaml-store/src/index.ts'),
            },
            {
                find: '@hierarchidb/plugin-base',
                replacement: path.resolve(pluginBaseSrc, 'index.ts'),
            },
            // plugin-base uses ~ internally to refer to its own src root.
            // yaml-plugin src does NOT use ~ itself, so mapping ~ → plugin-base/src is safe here.
            { find: '~', replacement: pluginBaseSrc },
        ],
    },
});
