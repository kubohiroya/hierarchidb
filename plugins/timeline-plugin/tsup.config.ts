import { createTsupConfig } from "../../../tsup.base.config.js";

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
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/index.ts',
      'services/index': 'src/services/index.ts',
    'worker-factory/index': 'src/worker/factory/index.ts',
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
