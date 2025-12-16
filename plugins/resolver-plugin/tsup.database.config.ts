import { createTsupConfig } from '../../tsup.base.config.ts';

const TsupDatabaseConfig = createTsupConfig({
  entry: {
    'database/index': 'src/worker/database/index.ts',
  },
  external: [
    'dexie',
    '@hierarchidb/_obsolate_common-types',
  ],
});
export { TsupDatabaseConfig };
