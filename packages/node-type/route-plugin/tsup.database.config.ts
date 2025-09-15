import { createTsupConfig } from '../../../tsup.base.config';

export default createTsupConfig({
  entry: {
    'database/index': 'src/database/index.ts',
  },
  external: [
    'dexie',
  ],
});

