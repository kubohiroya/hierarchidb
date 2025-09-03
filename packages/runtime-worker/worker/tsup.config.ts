import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  dts: true,
  external: [
    'provider',
    'provider-dom',
    '@mui/material',
    '@mui/icons-material',
    '@emotion/provider',
    '@emotion/styled',
    'dexie',
    '@hierarchidb/feature-registry',
    '@hierarchidb/tabular',
    '@hierarchidb/tabular-xlsx',
    '@hierarchidb/compute',
    '@hierarchidb/batch',
    '@hierarchidb/download',
    '@hierarchidb/map-source',
    '@hierarchidb/map-view',
    '@hierarchidb/auth-recovery',
  ],
});
