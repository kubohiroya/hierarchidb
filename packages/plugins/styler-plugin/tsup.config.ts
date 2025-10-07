import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: {
    'index': 'src/RuntimeWorkerService.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'shared/index': 'src/shared/RuntimeWorkerService.ts',
    'services/index': 'src/services/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
  },
  dts: {
    entry: {
      'index': 'src/RuntimeWorkerService.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'shared/index': 'src/shared/RuntimeWorkerService.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
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
