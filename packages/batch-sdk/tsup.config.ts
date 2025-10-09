import { createTsupConfig } from '../../tsup.base.config.js';

// Align with monorepo defaults and emit .d.ts files
export default createTsupConfig({
  // Base plugin is framework-only; keep peer deps external to avoid bundling duplicates
  external: [
    "react",
    "@hierarchidb/common-types",
    "@hierarchidb/common-api",
    "@hierarchidb/download",
    "@hierarchidb/auth-recovery"
  ],
});
