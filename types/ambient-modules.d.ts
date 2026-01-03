/// <reference types="vite/client" />

// This file centralizes non-TS module shims and asset module declarations.
// Policy: do not keep hand-maintained .d.ts files under src/ because they drift.

// JSON metadata outputs from @hierarchidb/fetch-save-metadata
// (imported by plugins/shape-plugin/...)
declare module '@hierarchidb/fetch-save-metadata/output/*.json' {
  const data: Record<string, unknown>[];
  export default data;
}
