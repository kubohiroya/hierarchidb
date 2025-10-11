import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/worker/RuntimeWorkerService.ts",
    "src/ui/RuntimeWorkerService.ts",
    "src/services/RuntimeWorkerService.ts",
    "src/worker-factory/RuntimeWorkerService.ts"
  ],
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    },
  },
  external: [
    // Explicit peers
    '@emotion/react',
    '@emotion/styled',
    '@mui/icons-material',
    '@mui/material',
    '@hierarchidb/ui-dialog',
    'react',
  ],
});
