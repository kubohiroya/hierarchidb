module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    // Type-aware rules require parserOptions.project
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    // Prefer TS-aware unused vars rule and ignore leading underscores
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],

    // General rules
    'prefer-const': 'warn',
    'no-unused-vars': 'off', // Use TS-aware variant above

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
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.turbo',
    '*.config.js',
    '*.config.ts',
    '.eslintrc.cjs',
    'coverage',
    'playwright-report',
  ],
};
