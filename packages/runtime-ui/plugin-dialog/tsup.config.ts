import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/ui-icon',
    '@hierarchidb/ui-core',
    '@hierarchidb/runtime-worker-bootstrap',
  ],
});
