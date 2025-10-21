import { createTsupConfig } from '../../../tsup.base.config.js';

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
  external: [
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*'
  ],
});
