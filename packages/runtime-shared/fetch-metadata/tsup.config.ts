import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
});
