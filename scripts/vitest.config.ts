import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/__tests__/**/*.test.ts'],
    passWithNoTests: false,
  },
});
