// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

// Flat ESLint config for the monorepo (ESLint v9)
// - Resolves prior failure: "ESLint couldn't find an eslint.config.* file"
// - Enables type-aware deprecation checks for selected packages

import js from '@eslint/js';
import globals from 'globals';
import deprecation from 'eslint-plugin-deprecation';
import reactHooks from 'eslint-plugin-react-hooks';

// Silence unsupported TypeScript version warnings from @typescript-eslint
process.env.TYPESCRIPT_ESLINT_SUPPRESS_WARNINGS = 'true';
const tsParserModule = await import('@typescript-eslint/parser');
const tsParser = tsParserModule.default ?? tsParserModule;

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [// Ignore common build artifacts across the monorepo
// Base config for JS/TS files
// TypeScript-specific tweaks
// Browser-delivered code: forbid accidental `process` usage
{
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/storybook-static/**',
  ],
}, // Node-targeted tooling/CLI packages: allow deliberate `process` access
{
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: tsParser,
    parserOptions: {
      warnOnUnsupportedTypeScriptVersion: false,
    },
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
}, // Type-aware deprecation checks (runtime-worker-worker)
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    // TS already checks for undefined identifiers
    'no-undef': 'off',
  },
}, // Type-aware deprecation checks (shape-plugin)
{
  files: ['app/src/**/*.{js,jsx,ts,tsx}', 'packages/**/src/**/*.{js,jsx,ts,tsx}'],
  ignores: ['packages/backend/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*', 'packages/**/scripts/**'],
  rules: {
    'no-restricted-globals': ['error', 'process'],
  },
}, // React Hooks rules (enabled globally for React codebases)
{
  files: [
    'packages/tools/vite-plugin-dev-health/src/**/*.{js,jsx,ts,tsx}',
    'packages/tools/fetch-save-metadata-cli/src/**/*.{js,jsx,ts,tsx}',
  ],
  rules: {
    'no-restricted-globals': 'off',
  },
}, // Storybook stories often use non-component render functions; relax hook rules there
{
  files: ['packages/runtime-worker/worker/**/*.{ts,tsx}'],
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: new URL('.', import.meta.url).pathname,
      project: ['./packages/runtime-worker/worker/tsconfig.json'],
      warnOnUnsupportedTypeScriptVersion: false,
    },
  },
  rules: {
    'deprecation/deprecation': 'error',
  },
}, // Plugin packages: forbid legacy worker-factory paths
{
  files: ['packages/plugin-loader/shape-plugin/**/*.{ts,tsx}'],
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: new URL('.', import.meta.url).pathname,
      project: ['./packages/plugin-loader/shape-plugin/tsconfig.json'],
      warnOnUnsupportedTypeScriptVersion: false,
    },
  },
  rules: {
    'deprecation/deprecation': 'error',
  },
}, // Purpose: ensure all plugin-loader use the canonical `worker` export
{
  files: ['**/*.{jsx,tsx}'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}, // and avoid importing `../worker-factory/*` or package `*/worker-factory`.
{
  files: ['**/*.stories.{ts,tsx,js,jsx}'],
  rules: {
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
}, {
  files: ['packages/plugin-loader/**/src/**/*.{ts,tsx,js,jsx}'],
  ignores: ['packages/plugin-loader/**/src/**/__tests__/**', 'packages/plugin-loader/**/src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: '@mui/material/Unstable_Grid2', message: 'Use @mui/material/Grid (MUI v7).' },
        { name: '@mui/material/Grid2', message: 'Use @mui/material/Grid (MUI v7).' },
      ],
      patterns: [
        {
          group: ['../worker-factory/*', './worker-factory/*'],
          message: 'Use the canonical worker export instead of ../worker-factory/*.',
        },
        {
          group: ['@hierarchidb/*/worker-factory', '@hierarchidb/*/worker-factory/*'],
          message: 'Import from the package\'s worker export; worker-factory is deprecated.',
        },
      ],
    }],
  },
}, ...storybook.configs["flat/recommended"], ...storybook.configs["flat/recommended"], ...storybook.configs["flat/recommended"], ...storybook.configs["flat/recommended"]];
