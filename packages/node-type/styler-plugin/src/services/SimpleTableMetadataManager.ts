// Thin wrapper to bind the shared table-metadata manager to the styler DB name
import { SimpleTableMetadataManager as SharedManager } from '@hierarchidb/table-metadata';
import { getDBName } from '@hierarchidb/util';

export class SimpleTableMetadataManager extends SharedManager {
  constructor() {
    super(getDBName('styler-metadata-db'));
  }
}
