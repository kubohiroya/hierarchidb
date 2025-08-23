module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['deprecation', '@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: [
      './tsconfig.json',
      './packages/*/tsconfig.json',
      './packages/plugins/*/tsconfig.json'
    ],
    tsconfigRootDir: __dirname,
  },
  rules: {
    'deprecation/deprecation': 'error'
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.turbo/',
    'coverage/',
    '**/*.config.js',
    '**/*.config.ts',
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/__tests__/**/*'
  ]
};