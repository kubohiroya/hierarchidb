import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
  ],
});
