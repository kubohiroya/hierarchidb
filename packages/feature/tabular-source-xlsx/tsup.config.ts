import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({ dts: true, external: [
   '@hierarchidb/tabular-source',
   '@hierarchidb/tabular-source/*',
   '@hierarchidb/tabular-store',
   '@hierarchidb/tabular-store/*',
   'xlsx',
 ],});
