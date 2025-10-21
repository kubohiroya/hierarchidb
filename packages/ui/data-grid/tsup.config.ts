import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/tabular-store',
    '@hierarchidb/tabular-store/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    '@tanstack/react-virtual',
    '@tanstack/react-virtual/*',
    'react',
  ],});
