import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'database/index': 'src/database/index.ts',
    'worker/index': 'src/worker/index.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'database/index': 'src/database/index.ts',
      'worker/index': 'src/worker/index.ts',
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
  ],
});
