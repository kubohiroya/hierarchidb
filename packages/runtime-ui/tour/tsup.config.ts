import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@emotion/react',
    '@emotion/styled',
    // Optional node-type plugins loaded via dynamic import in register-default-extensions
    '@hierarchidb/node-type-shape-plugin',
    '@hierarchidb/node-type-spreadsheet-plugin',
    '@hierarchidb/node-type-basemap-plugin',
    '@hierarchidb/node-type-styler-plugin',
  ],
});
