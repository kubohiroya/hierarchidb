import { createTsupConfig } from '../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
    'ui/index': 'src/ui/index.ts',
    'database/index': 'src/services/database/index.ts',
  },
  dts: {
    entry: {
      'index': 'src/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
      'ui/index': 'src/ui/index.ts',
      'database/index': 'src/services/database/index.ts',
    },
  },
  external: [
    '@hierarchidb/auth-recovery',
    '@hierarchidb/batch',
    '@hierarchidb/common-api',
    '@hierarchidb/common-types',
    '@hierarchidb/download',
    '@hierarchidb/batch-types',
    '@hierarchidb/plugin-types',
    '@hierarchidb/plugin-ui-sdk',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-ui-plugin-dialog',
    '@hierarchidb/tabular-store',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-dialog',
    '@hierarchidb/util',
    // workspace deps that must stay external in host app
    '@hierarchidb/runtime-client',
    '@hierarchidb/runtime-worker-factory',
  ],
});
