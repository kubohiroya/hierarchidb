import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
    // Optional node-type plugins loaded via dynamic import in register-default-extensions
    '@hierarchidb/shape-plugin',
    '@hierarchidb/spreadsheet-plugin',
    '@hierarchidb/basemap-plugin',
    '@hierarchidb/styler-plugin',
  ],
});
