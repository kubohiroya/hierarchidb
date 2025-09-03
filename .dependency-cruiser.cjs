/*
  Minimal dependency-cruiser config:
  - Warn on cycles
  - Error on cross-package ../src imports (must consume built outputs or declared exports)
*/
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: ['dist', 'build', 'coverage', '.turbo'],
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+/[^/]+' },
    },
  },
  forbidden: [
    {
      name: 'no-cycles',
      comment: 'Avoid cyclical dependencies for maintainability',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-cross-src',
      comment: 'Do not import another package\'s ../src directly; use its built exports instead',
      severity: 'warn',
      from: { path: '^packages/.+/src' },
      to: { path: '^packages/.+/src' },
    },
  ],
};
