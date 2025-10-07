import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
    // Optional node-type plugin-loader loaded via dynamic import in register-default-extensions
    '@hierarchidb/plugin-loader-shape-plugin',
    '@hierarchidb/plugin-loader-spreadsheet-plugin',
    '@hierarchidb/plugin-loader-basemap-plugin',
    '@hierarchidb/plugin-loader-styler-plugin',
  ],
});
