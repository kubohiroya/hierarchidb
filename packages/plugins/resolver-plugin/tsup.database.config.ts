import { createTsupConfig } from '../../../tsup.base.config.js';

const TsupDatabaseConfig = createTsupConfig({
  entry: {
    'database/index': 'src/database/index.ts',
  },
  external: [
    'dexie',
  ],
});
export { TsupDatabaseConfig };

