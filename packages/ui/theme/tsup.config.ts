import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
  ],
});
