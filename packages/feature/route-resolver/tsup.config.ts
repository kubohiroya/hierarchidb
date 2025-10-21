import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({ dts: true, external: [
export default createTsupConfig({ dts: true,   '@webgpu/types',
export default createTsupConfig({ dts: true,   '@webgpu/types/*',
export default createTsupConfig({ dts: true, ],});
