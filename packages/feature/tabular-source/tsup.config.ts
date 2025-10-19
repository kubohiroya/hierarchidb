import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  dts: {
    entry: {
      index: 'src/index.ts',
      types: 'src/types.ts',
      ports: 'src/ports.ts',
      registry: 'src/registry.ts',
    },
  },
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
    ports: 'src/ports.ts',
    registry: 'src/registry.ts',
  },
});
