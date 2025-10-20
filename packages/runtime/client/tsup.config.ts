import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'provider',
    'provider-dom',
    // peer libs
    'comlink',
    'dexie',
    // UI peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    "@hierarchidb/common-types",
    "@hierarchidb/common-api",
    "@hierarchidb/runtime-worker"
  ],
});
