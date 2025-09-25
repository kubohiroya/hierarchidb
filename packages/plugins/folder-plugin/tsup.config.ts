import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'ui/index': 'src/ui/index.ts',
    'shared/index': 'src/shared/index.ts',
    'worker/index': 'src/worker/index.ts',
    'worker-factory/index': 'src/worker-factory/index.ts',
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
    // Optional node-type plugins loaded dynamically; keep external to avoid bundle-time resolution
    '@hierarchidb/plugins-shape-plugin',
    '@hierarchidb/plugins-spreadsheet-plugin',
    '@hierarchidb/plugins-basemap-plugin',
    '@hierarchidb/plugins-styler-plugin',
  ],
});
