import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  format: ['esm'],
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
  ],
});
