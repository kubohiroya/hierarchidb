module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: false },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['deprecation'],
  overrides: [
    {
      files: ['packages/{ui,runtime-worker,node-type}/**/*.{ts,tsx,js,jsx}'],
      excludedFiles: [
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        'packages/**/scripts/**',
        'packages/backend/**',
      ],
      rules: {
        // Ban process usage in browser-delivered code (use props/DI/import.meta.env/globalThis.FEATURE_FLAGS instead)
        'no-restricted-globals': ['error', 'process'],
      },
    },
    // CI-only deprecation checks (type-aware) for core packages
    {
      files: ['packages/runtime-worker/worker/**/*.{ts,tsx}'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './packages/runtime-worker/worker/tsconfig.json',
      },
      rules: {
        'deprecation/deprecation': 'error',
      },
    },
    {
      files: ['packages/node-type/shape-plugin/**/*.{ts,tsx}'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './packages/node-type/shape-plugin/tsconfig.json',
      },
      rules: {
        'deprecation/deprecation': 'error',
      },
    },
  ],
};
