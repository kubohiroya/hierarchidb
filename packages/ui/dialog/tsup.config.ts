import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
    'react-dom',
    'react-draggable',
    'react-resizable',
  ],});
