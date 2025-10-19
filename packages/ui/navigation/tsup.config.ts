import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  external: [
    'react',
    '@tanstack/react-router',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
  ],
});
