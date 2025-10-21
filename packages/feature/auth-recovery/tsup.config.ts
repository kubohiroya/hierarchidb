import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: ['src/index.ts'],
  external: [
    '@hierarchidb/common-auth',
    '@hierarchidb/common-auth/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
  ],
});
