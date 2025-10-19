import { createTsupConfig } from "../../tsup.base.config.ts";

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'services/index': 'src/services/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'ui/index': 'src/ui/index.ts',
      'services/index': 'src/services/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    'react',
    'react-dom',
    'dexie',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/components',
    '@hierarchidb/batch',
    '@hierarchidb/batch-sdk',
    '@hierarchidb/download',
    '@hierarchidb/util',
    '@hierarchidb/common-types',
    '@hierarchidb/common-api',
    '@hierarchidb/plugin-types',
    '@hierarchidb/plugin-ui-sdk',
    '@hierarchidb/batch-api',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-datasource',
    '@hierarchidb/ui-license',
    '@hierarchidb/tabular-store',
    '@hierarchidb/runtime-plugin-dialog',
    '@hierarchidb/auth-recovery',
    '@hierarchidb/common-auth',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/ui-dialog'
  ]
});
