import { createTsupConfig } from '../../../../tsup.base.config.ts';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@tanstack/react-router',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'jotai',
  ],
});
