import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@tanstack/react-router',
    'jotai',
    '@hierarchidb/ui-icon',
    '@hierarchidb/ui-core',
    '@hierarchidb/runtime-client',
  ],
});
