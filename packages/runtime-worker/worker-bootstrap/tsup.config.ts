import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
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
