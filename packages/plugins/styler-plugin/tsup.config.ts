import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: {
    'index': 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'shared/index': 'src/shared/index.ts',
    'services/index': 'src/services/index.ts',
    'worker/index': 'src/worker/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/index.ts',
      'shared/index': 'src/shared/index.ts',
      'services/index': 'src/services/index.ts',
      'worker/index': 'src/worker/index.ts',
    },
  },
  external: [
    '@hierarchidb/runtime-ui-plugin-dialog',
    '@hierarchidb/plugins-spreadsheet-plugin',
    // Explicit peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
    'i18next',
    'react-i18next',
  ],
});
