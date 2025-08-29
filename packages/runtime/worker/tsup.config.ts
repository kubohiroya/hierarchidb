import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: false, // Temporarily disable DTS generation
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
  ],
});
