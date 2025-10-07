import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/RuntimeWorkerService.ts',
    'ui/index': 'src/ui/RuntimeWorkerService.ts',
    'shared/index': 'src/shared/RuntimeWorkerService.ts',
    'worker/index': 'src/worker/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
  },
  splitting: false,
  external: [
    // UI peers
    'react',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    // runtime peers
    'dexie',
    // Optional node-type plugin-loader loaded dynamically; keep external to avoid bundle-time resolution
    '@hierarchidb/plugin-loader-shape-plugin',
    '@hierarchidb/plugin-loader-spreadsheet-plugin',
    '@hierarchidb/plugin-loader-basemap-plugin',
    '@hierarchidb/plugin-loader-styler-plugin',
  ],
});
