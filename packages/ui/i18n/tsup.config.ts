import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    // Keep runtime deps external to avoid bundling and dts chasing
    'i18next-browser-languagedetector',
    'i18next-http-backend',
    'date-fns',
    'date-fns/locale',
  ],
});
