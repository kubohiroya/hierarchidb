import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['__tests__/**/*.ts'],
    },
    resolve: {
        alias: {
            '@hierarchidb/core-types': path.resolve(__dirname, '../core-types/src/index.ts'),
        },
    },
});
