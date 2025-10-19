import { createTsupConfig } from '../../tsup.base.config.ts';

const TsupDatabaseConfig = createTsupConfig({
  entry: {
    'database/index': 'src/worker/database/index.ts',
  },
  external: [
    'dexie',
    '@hierarchidb/common-types',
  ],
});
export { TsupDatabaseConfig };
