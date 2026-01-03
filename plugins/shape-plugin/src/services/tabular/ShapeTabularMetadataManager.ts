import { getDBName } from '@hierarchidb/util';
import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

/**
 * Metadata manager dedicated to Shape plugin tabular datasets.
 * Keeps table metadata isolated from spreadsheet/styler stores.
 */
export class ShapeTabularMetadataManager extends TabularDatabaseManager {
  constructor(dbName: string = getDBName('shape-ephemeral')) {
    super(dbName);
  }
}
