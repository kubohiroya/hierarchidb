import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@deck.gl/geo-layers',
    '@deck.gl/geo-layers/*',
    '@deck.gl/layers',
    '@deck.gl/layers/*',
    '@deck.gl/mapbox',
    '@deck.gl/mapbox/*',
    '@emotion/react',
    '@emotion/react/*',
    '@emotion/styled',
    '@emotion/styled/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    '@hierarchidb/ui-data-grid',
    '@hierarchidb/ui-data-grid/*',
    '@mui/material',
    '@mui/material/*',
    '@vis.gl/react-maplibre',
    '@vis.gl/react-maplibre/*',
    'maplibre-gl',
    'react',
  ],});
