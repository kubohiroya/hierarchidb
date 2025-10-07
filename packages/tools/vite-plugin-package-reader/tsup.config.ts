import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/RuntimeWorkerService.ts',
      'presets/index': 'src/presets/RuntimeWorkerService.ts',
    },
  },
  entry: {
    index: 'src/RuntimeWorkerService.ts',
    'presets/index': 'src/presets/RuntimeWorkerService.ts',
  },
  format: ['esm'],
  external: ['vite'],
});
