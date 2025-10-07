import { createTsupConfig } from '../../../tsup.base.config.js';

const TsupDatabaseConfig = createTsupConfig({
  entry: {
    'database/index': 'src/database/RuntimeWorkerService.ts',
  },
  external: [
    'dexie',
  ],
});
export { TsupDatabaseConfig };

