import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({ external: [
    '@hierarchidb/util',
   '@hierarchidb/util/*',
   'dexie',],});
