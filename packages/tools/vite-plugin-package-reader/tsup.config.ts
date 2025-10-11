import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/index.ts',
      'presets/index': 'src/presets/index.ts',
    },
  },
  entry: {
    index: 'src/index.ts',
    'presets/index': 'src/presets/index.ts',
  },
  format: ['esm'],
  external: ['vite'],
});
