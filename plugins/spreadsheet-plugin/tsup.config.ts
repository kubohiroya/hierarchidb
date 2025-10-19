import { createTsupConfig } from '../../tsup.base.config.ts';

export default createTsupConfig({
  entry: {
    'index': 'src/index.ts',
    'database/index': 'src/services/database/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
    'ui/index': 'src/ui/facade/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'database/index': 'src/services/database/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
      'ui/index': 'src/ui/facade/index.ts',
    },
  },
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
    '@hierarchidb/plugin-ui-sdk',
    '@hierarchidb/runtime-ui-plugin-dialog',
    // bundle internal workspace deps and non-UI libs
  ],
});
