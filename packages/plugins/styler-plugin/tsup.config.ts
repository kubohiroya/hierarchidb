import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: {
    'index': 'src/index.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'shared/index': 'src/shared/RuntimeWorkerService.ts',
    'services/index': 'src/services/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'shared/index': 'src/shared/RuntimeWorkerService.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    },
  },
  external: [
    '@mui/icons-material',
    '@mui/material',
    'react',
    'react-dom',
    'dexie',
    'react-i18next',
    'i18next',
    '@hierarchidb/util',
    '@hierarchidb/tabular-store',
    '@hierarchidb/plugins-folder-plugin',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-csv-extract',
    '@hierarchidb/common-types',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/plugins-spreadsheet-plugin',
    '@hierarchidb/runtime-ui-plugin-dialog',
    '@emotion/react',
    '@emotion/styled',
  ],
});
