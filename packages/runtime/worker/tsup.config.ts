import { createTsupConfig } from '../../../tsup.base.config.js';

const cfg = createTsupConfig({
  // Build main entry (index) and worker entry
  entry: ['src/index.ts', 'src/index.ts', 'src/stageWorker.entry.ts'],
  dts: true,
  external: [
    'provider',
    'provider-dom',
    'jotai',
    "@hierarchidb/auth-recovery",
    "@hierarchidb/common-api",
    "@hierarchidb/common-types",
    "@hierarchidb/compute",
    "@hierarchidb/download",
    "@hierarchidb/import-export",
  "@hierarchidb/map-adapter",
  "@hierarchidb/map-source",
  "@hierarchidb/tabular-source",
  "@hierarchidb/tag",
  "@hierarchidb/util",
  "@hierarchidb/batch-api",
  "@hierarchidb/feature-registry",
  "@maplibre/vt-pbf",
    'virtual:plugin-registry-worker'
// UI libs are already in base externals; internal/workers deps should bundle
  ],
});

export default cfg;
