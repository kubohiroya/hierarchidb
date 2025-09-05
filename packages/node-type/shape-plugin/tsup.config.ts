import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: true,
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/runtime-worker',
    'dexie',
  ],
});
