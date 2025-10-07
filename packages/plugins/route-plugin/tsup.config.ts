import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'database/index': 'src/database/RuntimeWorkerService.ts',
  },
  dts: {
    entry: {
      'index': 'src/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'database/index': 'src/database/RuntimeWorkerService.ts',
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
