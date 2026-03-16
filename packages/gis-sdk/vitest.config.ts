import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/__tests__/**/*.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
    },
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src'),
            '@hierarchidb/core-types': path.resolve(__dirname, '../core-types/src/index.ts'),
            '@hierarchidb/util': path.resolve(__dirname, '../util/src/index.ts'),
            '@hierarchidb/shape-api': path.resolve(__dirname, '../shape-api/src/index.ts'),
            '@hierarchidb/vectortile-store': path.resolve(__dirname, '../vectortile-store/src/index.ts'),
        },
    },
});
