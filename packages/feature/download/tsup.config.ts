import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: true,
  external: [
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    'dexie',
    '@noble/hashes',
    '@hierarchidb/auth-recovery',
    '@hierarchidb/auth-recovery/*'
  ],
});
