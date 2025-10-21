import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@hierarchidb/common-auth',
    '@hierarchidb/common-auth/*',
    '@hierarchidb/ui-auth',
    '@hierarchidb/ui-auth/*',
    '@hierarchidb/ui-i18n',
    '@hierarchidb/ui-i18n/*',
    '@hierarchidb/ui-monitoring',
    '@hierarchidb/ui-monitoring/*',
    '@hierarchidb/ui-theme',
    '@hierarchidb/ui-theme/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
    'react-dom',
  ],});
