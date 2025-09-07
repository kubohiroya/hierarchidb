import { createTsupConfig } from '../../../tsup.base.config';

// Rely on separate tsc emitDeclarationOnly step for d.ts to honor tsconfig paths.
export default createTsupConfig({ dts: false });
