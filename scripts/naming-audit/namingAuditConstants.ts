export const DEFAULT_NAMING_AUDIT_TARGET_DIRS: readonly string[] = [
  'app/src/',
  'packages/*/src/',
  'plugins/*-plugin/src/',
];

export const DEFAULT_NAMING_AUDIT_EXCLUDE_PATTERNS: readonly string[] = [
  'dist/',
  '*.d.ts',
  '__tests__/',
  '*.test.ts',
  '*.test.tsx',
  '*.spec.ts',
  '*.spec.tsx',
];

export const NAMING_AUDIT_ROUTER_EXCEPTION_PATHS: readonly string[] = ['app/src/router/**'];
