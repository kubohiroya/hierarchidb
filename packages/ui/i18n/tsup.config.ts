import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    '@mui/x-date-pickers',
    '@mui/x-date-pickers/*',
    'date-fns',
    'date-fns/locale',
    'i18next',
    'i18next-browser-languagedetector',
    'i18next-http-backend',
    'react',
    'react-i18next',
  ],});
