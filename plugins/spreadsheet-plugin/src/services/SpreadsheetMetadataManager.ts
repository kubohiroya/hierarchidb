import { TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class SpreadsheetMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string = getDBName('spreadsheet-metadata')) {
    super(dbName);
  }
}
