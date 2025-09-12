import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: [
    'src/index.ts',
    'src/worker/index.ts',
  ],
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/react',
    '@emotion/styled',
    'dexie',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/extensions',
    '@deck.gl/aggregation-layers',
    '@deck.gl/geo-layers',
    '@deck.gl/mapbox',
    '@deck.gl/mesh-layers',
    '@hierarchidb/runtime-worker',
  ],
});
