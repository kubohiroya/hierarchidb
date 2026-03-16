import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.spec.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
    },
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'src'),
        },
    },
});
