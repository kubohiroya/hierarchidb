import { createTsupConfig } from '../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@hierarchidb/download',
    '@hierarchidb/download/*',
    '@hierarchidb/plugin-ui-sdk',
    '@hierarchidb/plugin-ui-sdk/*',
    '@hierarchidb/plugin-types',
    '@hierarchidb/plugin-types/*',
    '@hierarchidb/common-types',
    '@hierarchidb/common-types/*',
    'dexie',
  ],
  clean: false,
});
