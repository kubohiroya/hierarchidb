import { createTsupConfig } from "../../../tsup.base.config.js";

export default createTsupConfig({
  entry: {
    index: 'src/index.ts',
    'services/index': 'src/services/RuntimeWorkerService.ts',
    'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
  },
  dts: {
    entry: {
      index: 'src/index.ts',
      'services/index': 'src/services/RuntimeWorkerService.ts',
      'worker-factory/index': 'src/worker-factory/RuntimeWorkerService.ts',
    },
  },
  external: [
    // Peer/runtime libs explicitly externalized to satisfy dep-fence
    'dexie',
    '@hierarchidb/runtime-worker',
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    '@hierarchidb/runtime-worker-bootstrap',
    'comlink',
    // Deck.gl family kept as peer-provided
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/extensions',
    '@deck.gl/aggregation-layers',
    '@deck.gl/geo-layers',
    '@deck.gl/mapbox',
    '@deck.gl/mesh-layers',
  ],
});
