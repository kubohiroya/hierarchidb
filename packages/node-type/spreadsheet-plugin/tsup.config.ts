import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'database/index': 'src/database/index.ts',
  },
  dts: false,
  external: [
    'provider',
    'provider-dom',
    'provider-i18next',
    'react-i18next',
    'i18next',
    'react',
    'dexie',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/runtime-ui-plugin-dialog',
    // bundle internal workspace deps and non-UI libs
  ],
});
