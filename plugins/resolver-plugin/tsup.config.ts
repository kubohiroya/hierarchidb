import { createTsupConfig } from '../../tsup.base.config.ts';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'database/index': 'src/worker/database/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'database/index': 'src/worker/database/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    // UI peers
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    // runtime peers
    'dexie',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-plugin-dialog',
    '@hierarchidb/common-types',
    '@hierarchidb/plugin-api',
    '@hierarchidb/common-api',
    '@hierarchidb/runtime-client',
    '@hierarchidb/runtime-basic-info',
    '@hierarchidb/download',
    '@hierarchidb/util',
  ],
});
