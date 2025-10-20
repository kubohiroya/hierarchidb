import { createTsupConfig } from '../../tsup.base.config';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'database/index': 'src/worker/database/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'database/index': 'src/worker/database/index.ts',
      'worker/index': 'src/worker/factory/index.ts',
    },
  },
  external: [
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-plugin-dialog',
    '@hierarchidb/common-types',
    '@hierarchidb/plugin-types',
    '@hierarchidb/common-api',
    '@hierarchidb/runtime-client',
    '@hierarchidb/runtime-basic-info',
    '@hierarchidb/download',
    '@hierarchidb/util',
  ],
});
