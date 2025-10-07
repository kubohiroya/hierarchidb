import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: [
    "src/RuntimeWorkerService.ts",
    "src/worker/RuntimeWorkerService.ts",
    "src/ui/RuntimeWorkerService.ts",
    "src/services/RuntimeWorkerService.ts",
    "src/worker-factory/RuntimeWorkerService.ts",
  ],
  dts: {
    entry: {
      'index': 'src/RuntimeWorkerService.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/RuntimeWorkerService.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    },
  },
  external: [
    "react",
    "react-dom",
    "@mui/material",
    "@mui/icons-material",
    "@emotion/react",
    "@emotion/styled",
    "@hierarchidb/runtime-worker-bootstrap",
    "@hierarchidb/download",
    "@hierarchidb/batch",
    "@hierarchidb/plugin-loader-runtime-worker-factory",
    "dexie"
  ]
});
