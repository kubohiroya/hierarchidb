import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@hierarchidb/tabular-source',
    '@hierarchidb/tabular-source/*',
    '@hierarchidb/tabular-store',
    '@hierarchidb/tabular-store/*',
    '@hierarchidb/ui-file',
    '@hierarchidb/ui-file/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
    'react-dom',
  ],});
