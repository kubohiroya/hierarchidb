import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  clean: false,
  dts: false,
  external: [
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/download',
    '@hierarchidb/download/*',
    'react'
  ],
});
