import { createTsupConfig } from "../../tsup.base.config";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/worker/index.ts",
    "src/ui/index.ts",
    "src/services/index.ts",
    "src/worker/factory/index.ts"
  ],
  dts: {
    entry: {
      'index': 'src/index.ts',
      'ui/index': 'src/ui/index.ts',      'services/index': 'src/services/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/plugin-types',
    '@hierarchidb/plugin-types/*',
    '@hierarchidb/runtime-plugin-dialog',
    '@hierarchidb/runtime-plugin-dialog/*',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-worker/*',
    '@hierarchidb/ui-dialog',
    '@hierarchidb/ui-dialog/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    '@mui/icons-material',
    '@mui/icons-material/*',
    '@mui/material',
    '@mui/material/*',
    'react',
  ],});
