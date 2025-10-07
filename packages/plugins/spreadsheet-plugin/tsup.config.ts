import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    'index': 'src/RuntimeWorkerService.ts',
    'database/index': 'src/database/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    'ui/index': 'src/ui/facade/RuntimeWorkerService.ts',
  },
  dts: {
    entry: {
      'index': 'src/RuntimeWorkerService.ts',
      'database/index': 'src/database/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
      'ui/index': 'src/ui/facade/RuntimeWorkerService.ts',
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
    '@hierarchidb/runtime-ui-plugin-dialog',
    // bundle internal workspace deps and non-UI libs
  ],
});
