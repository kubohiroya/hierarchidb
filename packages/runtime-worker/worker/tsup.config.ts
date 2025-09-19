import { createTsupConfig } from '../../../tsup.base.config.js';

const cfg = createTsupConfig({
  // Build both the main entry and the worker entry
  entry: ['src/index.ts', 'src/stageWorker.entry.ts'],
  dts: true,
  external: [
    'provider',
    'provider-dom',
    'jotai',
    // UI libs are already in base externals; internal/workers deps should bundle
  ],
});

export default cfg;
