import { createTsupConfig } from '../../../tsup.base.config.js';

export default createTsupConfig({
  entry: {
    'services/index': 'src/services/index.ts',
  },
  external: [
    'dexie',
  ],
});

