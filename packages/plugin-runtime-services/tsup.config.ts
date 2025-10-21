import { createTsupConfig } from '../../tsup.base.config.js';

export default createTsupConfig({
  external: [
    'dexie',
    '@hierarchidb/download',
  ],
  clean: false,
});
