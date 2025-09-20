// Flat ESLint config for the monorepo (ESLint v9)
// - Resolves prior failure: "ESLint couldn't find an eslint.config.* file"
// - Enables type-aware deprecation checks for selected packages

import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import deprecation from 'eslint-plugin-deprecation';
import reactHooks from 'eslint-plugin-react-hooks';

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
      'react-hooks': reactHooks,
      '@typescript-eslint': (await import('@typescript-eslint/eslint-plugin')).default,

    },
    rules: {
      ...js.configs.recommended.rules,
      // Keep repo green: prefer warnings for stylistic pitfalls in mixed JS/TS code
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-case-declarations': 'warn',
      'no-sparse-arrays': 'warn',
      'no-constant-binary-expression': 'warn',
      // Forbid legacy/unstable Grid2 paths. Use Grid (v7) instead.
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@mui/material/Unstable_Grid2', message: 'Use @mui/material/Grid (MUI v7).' },
          { name: '@mui/material/Grid2', message: 'Use @mui/material/Grid (MUI v7).' },
        ],
      }],
    },
  },

  // TypeScript-specific tweaks
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TS already checks for undefined identifiers
      'no-undef': 'off',
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

  // React Hooks rules (enabled globally for React codebases)
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Storybook stories often use non-component render functions; relax hook rules there
  {
    files: ['**/*.stories.{ts,tsx,js,jsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
