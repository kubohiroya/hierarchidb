import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'worker/index': 'src/worker/index.ts',
    'worker-factory/index': 'src/worker-factory/index.ts',
    'ui/index': 'src/ui/index.ts',
    'database/index': 'src/database/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'worker/index': 'src/worker/index.ts',
      'worker-factory/index': 'src/worker-factory/index.ts',
      'ui/index': 'src/ui/index.ts',
      'database/index': 'src/database/index.ts',
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
    '@hierarchidb/runtime-worker',
    // workspace deps that must stay external in host app
    '@hierarchidb/runtime-worker-bootstrap',
    '@hierarchidb/plugin-loader-runtime-worker-factory',
    // Treat ui-dialog as external optional peer to avoid bundling resolution
    '@hierarchidb/ui-dialog',
  ],
});
