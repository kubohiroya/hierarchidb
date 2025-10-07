import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/RuntimeWorkerService.ts',
      types: 'src/types.ts',
      ports: 'src/ports.ts',
      registry: 'src/registry.ts',
    },
  },
  entry: {
    index: 'src/RuntimeWorkerService.ts',
    types: 'src/types.ts',
    ports: 'src/ports.ts',
    registry: 'src/registry.ts',
  },
});

