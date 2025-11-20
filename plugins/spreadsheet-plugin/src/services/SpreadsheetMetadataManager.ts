import { SimpleTableMetadataManager as SharedMetadataManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class SpreadsheetMetadataManager extends SharedMetadataManager {
  constructor(dbName: string = getDBName('spreadsheet-metadata-db')) {
    super(dbName);
  }
}
