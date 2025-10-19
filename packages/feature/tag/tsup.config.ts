import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  dts: true,
  external: [
    'dexie',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
  ],
});
