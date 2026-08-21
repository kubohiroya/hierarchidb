import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export class SpreadsheetMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string) {
    super(dbName);
  }
}
