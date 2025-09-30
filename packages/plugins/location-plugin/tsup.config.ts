import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/worker/index.ts",
    "src/ui/index.ts",
    "src/services/index.ts",
    "src/worker-factory/index.ts",
  ],
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/index.ts',
      'services/index': 'src/services/index.ts',
      'worker-factory/index': 'src/worker-factory/index.ts',
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
    "@hierarchidb/plugins-runtime-worker-factory",
    "dexie"
  ]
});
