import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    // react-router-dom kept as dependency for now
    '@mui/icons-material',
    '@emotion/react',
  ],
});
