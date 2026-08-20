import path from 'path';
import { defineConfig } from 'vitest/config';

const RUN_AUTH_TESTS = process.env.AUTH_TESTS === '1';
const defaultTestFiles = [
  'src/components/__tests__/useOAuthCallbackView.unit.test.tsx',
  'src/services/__tests__/AuthSessionStorage.unit.test.ts',
  'src/services/__tests__/BffWarning.unit.test.ts',
  'src/services/__tests__/resolveAuthReturnUrl.unit.test.ts',
  'src/services/__tests__/startAuthCallbackNavigation.unit.test.ts',
];

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
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
      '~': path.resolve(__dirname, './src'),
      // Stub Google OAuth hook to avoid requiring GoogleOAuthProvider in tests
      '@react-oauth/google': path.resolve(__dirname, './src/test-shims/react-oauth-google.ts'),
    },
  },
  // Run the stable contract suite by default; keep the legacy component suite opt-in.
  ...(RUN_AUTH_TESTS
    ? {}
    : {
        test: {
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: defaultTestFiles,
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
      }),
});
