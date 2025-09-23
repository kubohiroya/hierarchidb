import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    'react-router-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
  ],
});
