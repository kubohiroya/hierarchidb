import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'provider',
    'provider-dom',
    'provider-i18next',
    'react-i18next',
    'i18next',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/tabular',
    '@hierarchidb/auth-recovery',
    'dexie',
  ],
});
