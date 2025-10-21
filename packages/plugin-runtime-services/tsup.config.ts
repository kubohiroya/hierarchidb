import { createTsupConfig } from '../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    '@hierarchidb/download',
    '@hierarchidb/download/*',
    'dexie',
  ],clean: false,
});
