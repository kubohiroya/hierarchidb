import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: true,
  external: [
    '@hierarchidb/map-source',
    '@hierarchidb/map-source/*',
    '@hierarchidb/util',
    '@hierarchidb/util/*',
    'deck.gl',
    'maplibre-gl',
  ],});
