import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: false, // Temporarily disable DTS generation
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
  ],
});
