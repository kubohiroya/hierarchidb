import { createTsupConfig } from '../../tsup.base.config.ts';

export default createTsupConfig({
  // Full build: library + UI + worker + dedicated workers
  dts: {
    entry: {
      index: 'src/index.ts',
      'shared/index': 'src/common/shared/index.ts',
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/public.ts',
      'services/index': 'src/services/index.ts',
      // worker entriesは内部型が多いため一旦除外
    },
  },
  entry: {
    index: 'src/index.ts',
    'shared/index': 'src/common/shared/index.ts',
    'ui/index': 'src/ui/index.ts',
    'worker/index': 'src/worker/factory/index.ts',
    'services/index': 'src/services/index.ts',
  },
  external: [
    'dexie',
    '@hierarchidb/batch-api',
    '@hierarchidb/plugin-api',
    '@hierarchidb/util',
    '@hierarchidb/auth-recovery',
    '@hierarchidb/common-api',
    '@hierarchidb/common-auth',
    '@hierarchidb/common-types',
    '@hierarchidb/tabular-store',
    '@hierarchidb/folder-plugin',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/ui-accordion-config',
    '@hierarchidb/ui-datasource',
    '@hierarchidb/ui-license',
    '@hierarchidb/batch',
    '@hierarchidb/ui-core',
    '@hierarchidb/ui-country-select',
    '@hierarchidb/runtime-plugin-dialog',
    '@hierarchidb/ui-lru-splitview',
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    // workspace deps (keep external when not bundled by host)
    '@hierarchidb/runtime-worker-factory',
    '@hierarchidb/runtime-client',
    '@hierarchidb/download',
    'provider',
    'provider-dom',
  ],
  splitting: false,
});
