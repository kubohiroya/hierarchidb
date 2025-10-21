import { createTsupConfig } from '../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    '@tanstack/react-router',
    '@tanstack/react-router/*',
    'react',
    'react-dom',
    'react-virtuoso',
  ],});
