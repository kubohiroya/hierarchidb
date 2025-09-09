// Thin wrapper to bind the shared table-metadata manager to the spreadsheet DB name

import { SimpleTableMetadataManager as SharedManager } from '@hierarchidb/table-metadata';
import { getDBName } from '@hierarchidb/util';

/**
  * : CSVIndexedDB
 * : StylerspreadsheetDB
 * :
 * : Dexie
  */
export class SimpleTableMetadataManager extends SharedManager {
  constructor(dbName: string = getDBName('spreadsheet-metadata-db')) {
    super(dbName);
  }

  /**
      * : CSV
   * :
   * :
   * :
      */
  // Methods are inherited from SharedManager

  /**
      * :
   * :
   * : Dexie
      */
  // get()

  /**
      * :
   * :
   * :
   * : Dexie
      */
  // list()

  /**
      * :
   * :
   * :
   * :
      */
  // findByHash()

  /**
      * :
   * :
   * :
   * :
      */
  // addReference()

  /**
      * :
   * : 0
   * :
   * :
   * @returns boolean - true
      */
  // removeReference()

  /**
      * :
   * :
   * :
   * :
      */
  // forceDelete()

  /**
      * :
   * :
   * :
   * :
      */
  // getTablesReferencedBy()

  /**
      * :
   * :
   * :
   * : Dexie
      */
  // update()

  /**
      * :
   * :
   * :
   * :
      */
  // getStatistics()

  /**
      * :
   * :
   * :
   * :
      */
  // cleanupOrphanedTables()
}
