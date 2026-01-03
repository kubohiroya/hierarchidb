// Thin wrapper to bind the shared table-metadata manager to the styler DB name
import { TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

export class StylerMetadataManager extends TabularDatabaseManager {
  constructor() {
    super(getDBName('styler'));
  }
}
