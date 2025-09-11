import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'provider',
    'provider-dom',
    // UI peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    // peer libs
    'comlink',
    'dexie',
  ],
});
