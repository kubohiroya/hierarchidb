import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({ dts: true, external: [
export default createTsupConfig({ dts: true,   '@hierarchidb/tabular-source',
export default createTsupConfig({ dts: true,   '@hierarchidb/tabular-source/*',
export default createTsupConfig({ dts: true,   '@hierarchidb/tabular-store',
export default createTsupConfig({ dts: true,   '@hierarchidb/tabular-store/*',
export default createTsupConfig({ dts: true,   'xlsx',
export default createTsupConfig({ dts: true, ],});
