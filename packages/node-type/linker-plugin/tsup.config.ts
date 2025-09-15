import { createTsupConfig } from "../../../tsup.base.config";

export default createTsupConfig({
  entry: [
    "src/index.ts",
    "src/services/index.ts",
  ],
  dts: false,
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
