// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores (replaces .eslintignore)
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      '.turbo',
      'coverage',
      'playwright-report',
      'docs/references/**',
      'references/**',
      'packages/eria-cargograph/**',
      '*.config.js',
      '*.config.ts',
      '.eslintrc.cjs',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript configs with type-aware rules
  ...tseslint.config(
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parserOptions: {
          project: './tsconfig.eslint.json',
          tsconfigRootDir: new URL('.', import.meta.url),
          ecmaVersion: 2022,
          sourceType: 'module',
        },
      },
      plugins: {
        import: importPlugin,
      },
      rules: {
        // TS aware unused vars rule
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
        ],

        // Import rules - 相対パスを禁止
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../*', './../*', '../../*', '../../../*', '.*/../*', './*'],
                message: 'Do not use relative path in import. Please use ~/ to use absolute path.',
              },
            ],
          },
        ],

        // Import order
        'import/order': [
          'warn',
          {
            groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
          },
        ],

        // General
        'prefer-const': 'warn',
        'no-unused-vars': 'off', // use TS variant
      },
    },
    tseslint.configs.recommendedTypeChecked,
  ),
];
