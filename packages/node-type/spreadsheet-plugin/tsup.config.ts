import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
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
    // bundle internal workspace deps and non-UI libs
  ],
});
