import { createTsupConfig } from '../../../tsup.base.config';

const cfg = createTsupConfig({
  // Build both the main entry and the worker entry
  entry: ['src/index.ts', 'src/stageWorker.entry.ts'],
  dts: true,
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
    '@hierarchidb/runtime-shared-batch-processor',
    'geojson-vt',
    '@maplibre/vt-pbf',
  ],
});

export default cfg;
