import { createTsupConfig } from '../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'worker/index': 'src/worker/index.ts',
    'worker-factory/index': 'src/worker/factory/index.ts',
    'ui/index': 'src/ui/index.ts',
    'database/index': 'src/services/database/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'worker/index': 'src/worker/index.ts',
      'worker-factory/index': 'src/worker/factory/index.ts',
      'ui/index': 'src/ui/index.ts',
      'database/index': 'src/services/database/index.ts',
    },
  },
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/auth-recovery',
    '@hierarchidb/batch',
    '@hierarchidb/common-api',
    '@hierarchidb/common-types',
    '@hierarchidb/download',
    '@hierarchidb/batch-api',
    '@hierarchidb/batch-sdk',
    '@hierarchidb/plugin-api',
    '@hierarchidb/plugin-sdk',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-ui-plugin-dialog',
    '@hierarchidb/tabular-store',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-dialog',
    '@hierarchidb/util',
    '@mui/icons-material',
    '@mui/material',
    'react',
    'react-dom',
    // workspace deps that must stay external in host app
    '@hierarchidb/runtime-client',
    '@hierarchidb/runtime-worker-factory',
  ],
});
