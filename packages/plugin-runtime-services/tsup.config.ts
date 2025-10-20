import { createTsupConfig } from '../../tsup.base.config';

export default createTsupConfig({
  external: [
    'dexie',
    '@hierarchidb/download',
  ],
});
