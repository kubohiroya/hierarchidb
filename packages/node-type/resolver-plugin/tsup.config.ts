import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    // UI peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    // runtime peers
    'dexie',
    '@hierarchidb/runtime-worker',
  ],
});
