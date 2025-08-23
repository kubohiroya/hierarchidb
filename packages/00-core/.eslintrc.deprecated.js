module.exports = {
  extends: ['../../.eslintrc.cjs'],
  plugins: ['deprecation'],
  rules: {
    // deprecated型使用時に警告
    'deprecation/deprecation': 'warn'
  },
  parserOptions: {
    project: './tsconfig.json'
  }
};