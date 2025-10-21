import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
  ],});
