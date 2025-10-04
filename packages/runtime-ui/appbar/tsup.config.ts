import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@tanstack/react-router',
  ],
});
