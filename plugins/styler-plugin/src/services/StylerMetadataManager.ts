// Thin wrapper to bind the shared table-metadata manager to the styler DB name
import { TabularDatabaseManager } from '@hierarchidb/tabular-store';

export class StylerMetadataManager extends TabularDatabaseManager {
  constructor(databaseName: string) {
    super(databaseName);
  }
}
