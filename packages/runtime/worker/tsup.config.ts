import { createTsupConfig } from '../../../tsup.base.config.js';

const cfg = createTsupConfig({
  // Build main entry (index) and worker entry
  entry: {
    index: 'src/index.ts',
    'stageWorker.entry': 'src/stageWorker.entry.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'stageWorker.entry': 'src/stageWorker.entry.ts',
    },
  },
  external: [
    '@hierarchidb/auth-recovery',
    '@hierarchidb/auth-recovery/*',
    '@hierarchidb/batch-types',
    '@hierarchidb/common-api',
    '@hierarchidb/common-api/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/compute',
    '@hierarchidb/compute/*',
    '@hierarchidb/download',
    '@hierarchidb/download/*',
    '@hierarchidb/feature-registry',
    '@hierarchidb/feature-registry/*',
    '@hierarchidb/import-export',
    '@hierarchidb/import-export/*',
    '@hierarchidb/map-adapter',
    '@hierarchidb/map-adapter/*',
    '@hierarchidb/map-source',
    '@hierarchidb/map-source/*',
    '@hierarchidb/plugin-registry',
    '@hierarchidb/plugin-registry/*',
    '@hierarchidb/plugin-types',
    '@hierarchidb/plugin-types/*',
    '@hierarchidb/tabular-source',
    '@hierarchidb/tabular-source-xlsx',
    '@hierarchidb/tabular-source-xlsx/*',
    '@hierarchidb/tabular-source/*',
    '@hierarchidb/tabular-store',
    '@hierarchidb/tabular-store/*',
    '@hierarchidb/tag',
    '@hierarchidb/tag/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    '@maplibre/vt-pbf',
    '@maplibre/vt-pbf/*',
    'jotai',
    'provider',
    'provider-dom',
  ],});

export default cfg;
