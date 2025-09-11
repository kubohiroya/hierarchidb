import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    // UI peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    // Treat ui-dialog as external optional peer to avoid bundling resolution
    '@hierarchidb/ui-dialog',
  ],
});
