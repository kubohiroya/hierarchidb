import { createTsupConfig } from '../../../tsup.base.config';

// Align with monorepo defaults and emit .d.ts files
export default createTsupConfig({
  // Base plugin is framework-only; no React runtime needed
  external: ['dexie'],
});
