import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@mui/material',
    'react',
    '@vis.gl/react-maplibre',
    'maplibre-gl',
    '@deck.gl/geo-layers',
    '@deck.gl/mapbox',
    '@deck.gl/layers'
  ],
});
