// Flat ESLint config for the monorepo (ESLint v9)
// - Resolves prior failure: "ESLint couldn't find an eslint.config.* file"
// - Enables type-aware deprecation checks for selected packages

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import deprecation from 'eslint-plugin-deprecation';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore common build artifacts across the monorepo
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/storybook-static/**',
    ],
  },

  // Base config for JS/TS files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      globals: {
        ...globals.es2022,
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      deprecation,
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // Browser-delivered code: forbid accidental `process` usage
  {
    files: ['packages/{ui,runtime-worker,node-type}/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', 'process'],
    },
  },

  // Type-aware deprecation checks (runtime-worker)
  {
    files: ['packages/runtime-worker/worker/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
        project: ['./packages/runtime-worker/worker/tsconfig.json'],
      },
    },
    rules: {
      'deprecation/deprecation': 'error',
    },
  },

  // Type-aware deprecation checks (shape-plugin)
  {
    files: ['packages/node-type/shape-plugin/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
        project: ['./packages/node-type/shape-plugin/tsconfig.json'],
      },
    },
    rules: {
      'deprecation/deprecation': 'error',
    },
  },
];

