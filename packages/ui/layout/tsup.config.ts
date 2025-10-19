import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@emotion/react',
    '@mui/icons-material',
  ],
});
