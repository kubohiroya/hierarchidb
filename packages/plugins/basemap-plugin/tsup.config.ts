import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    'database/index': 'src/database/RuntimeWorkerService.ts',
  },
  external: [
    'provider',
    'provider-dom',
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
  ],
});
