import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-worker/*',
    '@mui/icons-material',
    '@mui/material',
    'comlink',
    'dexie',
    'provider',
    'provider-dom',
    'react',
    'react-dom',
  ],});
