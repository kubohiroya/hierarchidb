// Thin wrapper to bind the shared table-metadata manager to the spreadsheet DB name

import { SimpleTableMetadataManager as SharedManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class SimpleTableMetadataManager extends SharedManager {
  constructor(dbName: string = getDBName('spreadsheet-metadata-db')) {
    super(dbName);
  }

  // Methods are inherited from SharedManager

}
