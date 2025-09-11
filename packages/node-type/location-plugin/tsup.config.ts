import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    // UI peers (must not be bundled)
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/batch',
  ],
});
