import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  // Full build: library + UI + worker + dedicated workers
  dts: {
    entry: {
      'index': 'src/index.ts',
      'shared/index': 'src/shared/index.ts',
      'ui/index': 'src/ui/index.ts',
      'worker/index': 'src/worker/public.ts',
      'services/index': 'src/services/index.ts',
      // worker entriesは内部型が多いため一旦除外
    },
  },
  entry: {
    'index': 'src/index.ts',
    'shared/index': 'src/shared/index.ts',
    'ui/index': 'src/ui/index.ts',
    'worker/index': 'src/worker/index.ts',
    'services/index': 'src/services/index.ts',
  },
  external: [
    'provider',
    'provider-dom',
    // UI peers must be externals
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    // workspace deps (keep external when not bundled by host)
    '@hierarchidb/runtime-worker-bootstrap',
    '@hierarchidb/download',
    'dexie',
  ],
  splitting: false,
});
