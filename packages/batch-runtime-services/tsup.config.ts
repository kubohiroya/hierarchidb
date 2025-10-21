import { createTsupConfig } from '../../tsup.base.config.js';

// Align with monorepo defaults and emit .d.ts files
export default createTsupConfig({
  // Base plugin is framework-only; keep peer deps external: [
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/auth-recovery',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/auth-recovery/*',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/common-api',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/common-api/*',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/common-types',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/common-types/*',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/download',
  // Base plugin is framework-only; keep peer deps   '@hierarchidb/download/*',
  // Base plugin is framework-only; keep peer deps   'react',
  // Base plugin is framework-only; keep peer deps ],});
