import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  // Full build: library + UI + worker + dedicated workers
  dts: {
    entry: {
      'index': 'src/index.ts',
      'shared/index': 'src/shared/index.ts',
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/public.ts',
      // worker entriesは内部型が多いため一旦除外
    },
  },
  entry: {
    'index': 'src/index.ts',
    'shared/index': 'src/shared/index.ts',
    'ui/index': 'src/ui/index.ts',
    'worker/index': 'src/worker/index.ts',
  },
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    '@hierarchidb/batch',
    '@hierarchidb/runtime-worker',
    '@hierarchidb/runtime-shared-batch-processor',
    '@hierarchidb/download',
    'dexie',
  ],
  splitting: false,
});
