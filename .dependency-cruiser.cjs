/*
  Minimal dependency-cruiser config:
  - Error on cycles
  - Ignore generated outputs (dist/stage/coverage/.turbo/storybook-static/app/.debug/reports)
*/
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: ['dist', 'build', 'coverage', '.turbo', 'storybook-static', 'app/.debug', 'reports'],
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
      comment: '循環依存を禁止（検出時はビルドを停止）',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
};
