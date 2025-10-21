import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  dts: true,
  external: [
    'dexie',
    '@hierarchidb/util',
    '@hierarchidb/util/*'
  ],
});
