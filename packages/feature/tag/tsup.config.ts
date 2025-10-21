import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: true,
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    '@mui/icons-material',
    '@mui/material',
    'dexie',
  ],});
