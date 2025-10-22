import { createTsupConfig } from '../../tsup.base.config.js';

// Align with monorepo defaults and emit .d.ts files
export default createTsupConfig({ external: [
    '@hierarchidb/auth-recovery',
    '@hierarchidb/auth-recovery/*',
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/download',
    '@hierarchidb/download/*',
    'react',
  ],});
