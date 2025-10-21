import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  format: ['esm'],
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
    'react-dom',
  ],});
