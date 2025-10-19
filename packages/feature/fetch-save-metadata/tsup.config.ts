import { createTsupConfig } from '../../../tsup.base.config.ts';

export default createTsupConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
});
