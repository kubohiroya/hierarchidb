import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: false,
  external: [
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    'react'
  ],
});
