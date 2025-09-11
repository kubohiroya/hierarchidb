import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    '@emotion/react',
    '@emotion/styled',
    '@mui/material',
    'react',
    '@deck.gl/mapbox',
  ],
});
