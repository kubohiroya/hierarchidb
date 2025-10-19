import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@mui/x-date-pickers',
    'i18next',
    'react-i18next',
    'i18next-browser-languagedetector',
    'i18next-http-backend',
    'date-fns',
    'date-fns/locale',
  ],
});
