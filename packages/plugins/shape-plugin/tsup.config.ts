import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  // Full build: library + UI + worker + dedicated workers
  dts: {
    entry: {
      'index': 'src/RuntimeWorkerService.ts',
      'shared/index': 'src/shared/RuntimeWorkerService.ts',
      'ui/index': 'src/ui/RuntimeWorkerService.ts',
      'worker/index': 'src/worker/public.ts',
      'worker-factory/index': 'src/worker-factory/public-types.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      // worker entriesは内部型が多いため一旦除外
    },
  },
  entry: {
    'index': 'src/RuntimeWorkerService.ts',
    'shared/index': 'src/shared/RuntimeWorkerService.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    'services/index': 'src/services/RuntimeWorkerService.ts',
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
    '@hierarchidb/plugin-loader-runtime-worker-factory',
    '@hierarchidb/runtime-worker-bootstrap',
    '@hierarchidb/download',
    'dexie',
  ],
  splitting: false,
});
