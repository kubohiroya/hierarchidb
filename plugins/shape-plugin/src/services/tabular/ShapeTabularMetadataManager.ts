import { SimpleTableMetadataManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

/**
 * Metadata manager dedicated to Shape plugin tabular datasets.
 * Keeps table metadata isolated from spreadsheet/styler stores.
 */
export class ShapeTabularMetadataManager extends SimpleTableMetadataManager {
  constructor(dbName: string = getDBName('shape-tabular-metadata-db')) {
    super(dbName);
  }
}
