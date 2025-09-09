import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  external: [
    '@hierarchidb/batch',
    '@maplibre/vt-pbf',
    'geojson-vt',
  ],
});
