// Thin wrapper to bind the shared table-metadata manager to the styler DB name
import { SimpleTableMetadataManager as SharedManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class StylerMetadataManager extends SharedManager {
  constructor() {
    super(getDBName('styler-metadata-db'));
  }
}
