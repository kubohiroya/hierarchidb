import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@mui/material',
    'react',
    '@deck.gl/mapbox',
  ],
});
