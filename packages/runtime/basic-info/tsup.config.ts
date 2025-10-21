import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/runtime-client',
    '@hierarchidb/runtime-client/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    '@tanstack/react-router',
    'react',
    'react-dom',
    'react-virtuoso',
  ],});
