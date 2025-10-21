import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({ external: [
export default createTsupConfig({   '@hierarchidb/util',
export default createTsupConfig({   '@hierarchidb/util/*',
export default createTsupConfig({   'dexie',
export default createTsupConfig({ ],});
