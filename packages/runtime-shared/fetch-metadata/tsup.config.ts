import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: ['src/RuntimeWorkerService.ts'],
  format: ['esm'],
});
