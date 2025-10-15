import { createTsupConfig } from "../../tsup.base.config.js";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/worker/index.ts",
    "src/ui/index.ts",
    "src/services/index.ts",
    "src/worker/factory/index.ts",
  ],
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/index.ts',
      'services/index': 'src/services/index.ts',
      'worker-factory/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    "react",
    "react-dom",
    "dexie",
    "@mui/material",
    "@mui/icons-material",
    "@emotion/react",
    "@emotion/styled",
    "@hierarchidb/batch",
    "@hierarchidb/download",
    "@hierarchidb/util",
    "@hierarchidb/common-types",
    "@hierarchidb/common-api",
    "@hierarchidb/plugin-api",
    "@hierarchidb/batch-api",
    "@hierarchidb/ui-core",
    "@hierarchidb/ui-datasource",
    "@hierarchidb/ui-license",
    "@hierarchidb/tabular-store",
    "@hierarchidb/runtime-ui-plugin-dialog",
    "@hierarchidb/auth-recovery",
    "@hierarchidb/common-auth",
    "@hierarchidb/runtime-worker",
    "@hierarchidb/ui-dialog"
  ]
});
