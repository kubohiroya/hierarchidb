import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  // JS build entries
  entry: [
    'src/index.ts',
    'src/worker/index.ts',
    'src/ui/index.ts',
    'src/database/index.ts',
  ],
  // Narrow DTS generation to the stable library surface; exclude UI/worker from DTS
  dts: {
    entry: {
      'index': 'src/index.ts',
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
    // Treat ui-dialog as external optional peer to avoid bundling resolution
    '@hierarchidb/ui-dialog',
  ],
});
