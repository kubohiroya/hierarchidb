import { createTsupConfig } from '../../tsup.base.config.ts';

// Align with monorepo defaults and emit .d.ts files
export default createTsupConfig({
  // Base plugin is framework-only; keep peer deps external to avoid bundling duplicates
  external: [
    'dexie', 'react',
  "@hierarchidb/common-types",
  "@hierarchidb/common-api",
  "@hierarchidb/batch-types",
  "@hierarchidb/runtime-worker"
],
});
