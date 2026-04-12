import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        root: path.resolve(__dirname),
        include: ['__tests__/**/*.test.ts'],
        environment: 'node',
    },
});
